import {
  type CopyObjectCommandInput,
  GetObjectCommand,
  type HeadObjectOutput,
  MetadataDirective,
  S3,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import path from 'path';
import { pipeline } from 'stream/promises';

import type { FastifyBaseLogger } from 'fastify';

import type { UUID } from '@graasp/sdk';

import { S3_FILE_ITEM_HOST, TMP_FOLDER } from '../../../utils/config';
import type { S3FileConfiguration } from '../interfaces/configuration';
import type { FileRepository, FileUpload } from '../interfaces/fileRepository';
import type { FileStorageType } from '../types';
import { S3_PRESIGNED_EXPIRATION } from '../utils/constants';
import {
  DownloadFileUnexpectedError,
  S3FileNotFound,
  UploadFileUnexpectedError,
} from '../utils/errors';

export class S3FileRepository implements FileRepository {
  private readonly options: S3FileConfiguration;
  private readonly s3Instance: S3;
  readonly fileStorageType: FileStorageType;

  constructor(options: S3FileConfiguration) {
    this.options = options;

    const {
      s3Region: region,
      s3AccessKeyId: accessKeyId,
      s3SecretAccessKey: secretAccessKey,
      s3UseAccelerateEndpoint: useAccelerateEndpoint = false,
    } = options;

    this.s3Instance = new S3({
      region,
      useAccelerateEndpoint,
      credentials: { accessKeyId, secretAccessKey },
      // This was required when we used localstack in development, now it is legacy.
      // Previously localstack did not allow the use of subdomains for bucket names and instead we had to use path-style urls: localhost:4566/<bucket>/<key> Instead of <bucket>.s3.<region>.amazonaws.com/<key>
      forcePathStyle: true,
      // this is necessary to use the garage instance
      // this overrides the default endpoint (amazonaws.com) with S3_FILE_ITEM_HOST
      endpoint: S3_FILE_ITEM_HOST,
    });
  }

  async getFileSize(filepath: string) {
    const metadata = await this.getMetadata(filepath);
    return metadata.ContentLength;
  }

  async copyFile({
    newId,
    memberId,
    originalPath,
    newFilePath,
    mimetype,
  }: {
    newId?: UUID;
    memberId: UUID;
    originalPath: string;
    newFilePath: string;
    filename: string;
    mimetype?: string;
  }): Promise<string> {
    const { s3Bucket: bucket } = this.options;

    // We ensure that only defined keys are assigned to the metadata object
    // Otherwise S3 cannot deal with 'undefined' values property
    const metadata = Object.fromEntries(
      Object.entries({ item: newId, member: memberId }).filter(([_k, v]) => v),
    ) as Record<string, string>;

    const params: CopyObjectCommandInput = {
      CopySource: `${bucket}/${originalPath}`,
      Bucket: bucket,
      Key: newFilePath,
      Metadata: metadata,
      MetadataDirective: 'REPLACE',
      ContentType: mimetype,
    };

    // TODO: the Cache-Control policy metadata is lost. try to set a global policy for the bucket in aws.
    await this.s3Instance.copyObject(params);

    return newFilePath;
  }

  async copyFolder({
    originalFolderPath,
    newFolderPath,
  }: {
    originalFolderPath: string;
    newFolderPath: string;
  }): Promise<string> {
    const { s3Bucket: bucket } = this.options;

    const { Contents } = await this.s3Instance.listObjectsV2({
      Bucket: bucket,
      Prefix: originalFolderPath,
    });

    const paths = Contents?.map(({ Key }) => Key);

    if (paths?.length) {
      const copyTasks = paths.map((filepath) => {
        if (filepath) {
          const params = {
            CopySource: `${bucket}/${filepath}`,
            Bucket: bucket,
            Key: filepath.replace(originalFolderPath, newFolderPath),
            MetadataDirective: MetadataDirective.COPY,
            CacheControl: 'no-cache', // TODO: improve?
          };
          return this.s3Instance.copyObject(params);
        }
      });
      await Promise.all(copyTasks);
    }

    return newFolderPath;
  }

  async deleteFile(filepath: string): Promise<void> {
    const { s3Bucket: bucket } = this.options;
    await this.s3Instance.deleteObject({
      Bucket: bucket,
      Key: filepath,
    });
  }

  async deleteFiles(filepaths: string[]): Promise<void> {
    const { s3Bucket: bucket } = this.options;
    const keys = filepaths.map((filepath) => {
      return { Key: filepath };
    });
    await this.s3Instance.deleteObjects({
      Bucket: bucket,
      Delete: {
        Objects: keys,
      },
    });
  }

  // delete all content in a folder
  async deleteFolder({ folderPath }: { folderPath: string }): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    // get all objects in a key
    // https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#listObjectsV2-property
    const { Contents } = await this.s3Instance.listObjectsV2({
      Bucket: bucket,
      Prefix: folderPath,
    });

    const filepaths = Contents?.map(({ Key }) => Key);
    const nonEmptyPaths = filepaths?.filter(Boolean);

    if (nonEmptyPaths?.length) {
      await this.s3Instance.deleteObjects({
        Bucket: bucket,
        Delete: {
          Objects: nonEmptyPaths.map((filepath) => ({
            Key: filepath,
          })),
          Quiet: false,
        },
      });
    }
  }

  private async _downloadS3File(
    { url, filepath, id }: { url: string; filepath: string; id: string },
    log: FastifyBaseLogger,
  ) {
    try {
      // return readstream of the file saved at given filepath
      // fetch and save file in temporary path
      const res = await fetch(url);

      if (!res.ok) {
        throw new S3FileNotFound();
      }

      const fileStream = fs.createWriteStream(filepath);
      await pipeline(res.body, fileStream);

      // create and return read stream (similar to local file service)
      const file = fs.createReadStream(filepath);

      file.on('close', function () {
        fs.unlinkSync(filepath);
      });

      return file;
    } catch (e) {
      log.error(e);
      if (
        e &&
        typeof e === 'object' &&
        'statusCode' in e &&
        e.statusCode === StatusCodes.NOT_FOUND
      ) {
        throw new S3FileNotFound({ filepath, id });
      }

      throw new DownloadFileUnexpectedError({ filepath, id, e });
    }
  }

  /**
   *
   * @param
   * @returns temporary file content
   */
  async getFile({ filepath, id }: { filepath: string; id: string }, log: FastifyBaseLogger) {
    const { s3Bucket: bucket } = this.options;
    try {
      // check whether file exists
      await this.getMetadata(filepath);

      const param = {
        expiresIn: S3_PRESIGNED_EXPIRATION,
      };

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: filepath,
      });
      const url = await getSignedUrl(this.s3Instance, command, param);

      // return readstream of the file saved in tmp folder
      // fetch and save file in temporary path
      const tmpPath = path.join(TMP_FOLDER, 'files', id);
      const file = await this._downloadS3File({ url, filepath: tmpPath, id }, log);

      return file;
    } catch (e) {
      log.error(e);
      if (!(e instanceof DownloadFileUnexpectedError)) {
        throw new DownloadFileUnexpectedError({ filepath, id });
      }
      throw e;
    }
  }

  async getUrl(
    {
      expiration,
      filepath,
      downloadName,
    }: { filepath: string; expiration?: number; downloadName?: string },
    log: FastifyBaseLogger,
  ) {
    const { s3Bucket: bucket } = this.options;
    try {
      // check whether file exists
      await this.getMetadata(filepath);

      const param = {
        expiresIn: expiration ?? S3_PRESIGNED_EXPIRATION,
      };

      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: filepath,
        ResponseContentDisposition: downloadName
          ? `attachment; filename="${downloadName}"`
          : undefined,
      });
      const url = await getSignedUrl(this.s3Instance, command, param);

      return url;
    } catch (e) {
      log.error(e);
      if (e && typeof e === 'object' && 'name' in e && e.name === 'NotFound') {
        throw new S3FileNotFound({ filepath });
      }
      if (!(e instanceof DownloadFileUnexpectedError)) {
        throw new DownloadFileUnexpectedError({ filepath });
      }
      log.error(e);
      throw e;
    }
  }

  async getMetadata(key: string): Promise<HeadObjectOutput> {
    const { s3Bucket: Bucket } = this.options;
    const metadata = await this.s3Instance.headObject({ Bucket, Key: key });
    return metadata;
  }

  async uploadFile(file: FileUpload): Promise<void> {
    await this.uploadFiles([file]);
  }

  async uploadFiles(files: FileUpload[]): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = files.map((file) => {
      return {
        Bucket: bucket,
        Key: file.filepath,
        Metadata: {
          member: file.memberId,
          // item: id <- cannot add item id
        },
        Body: file.fileStream,
        ContentType: file.mimetype,
      };
    });

    const uploads = params.map((param) => {
      return new Upload({
        client: this.s3Instance,
        params: param,
        partSize: 5 * 1024 * 1024, // Minimum part size defined by s3 is 5MB
        queueSize: 4, // Adjust this to fit our needs, currently at the default value
      });
    });

    try {
      await Promise.allSettled(uploads.map((upload) => upload.done()));

      console.debug(
        'Upload successfully at',
        files.map((f) => f.filepath),
      );
    } catch (err) {
      console.error('Something went wrong:', err);
      throw new UploadFileUnexpectedError(err);
    }
  }
}
