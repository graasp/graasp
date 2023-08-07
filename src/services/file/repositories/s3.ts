import { CopyObjectCommandInput, GetObjectCommand, HeadObjectOutput, S3 } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import contentDisposition from 'content-disposition';
import fs from 'fs';
import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import path from 'path';

import { FastifyReply } from 'fastify';

import { S3FileConfiguration, UUID } from '@graasp/sdk';

import { S3_FILE_ITEM_HOST } from '../../../utils/config';
import { FileRepository } from '../interfaces/fileRepository';
import { S3_PRESIGNED_EXPIRATION } from '../utils/constants';
import {
  DownloadFileUnexpectedError,
  S3FileNotFound,
  UploadFileUnexpectedError,
} from '../utils/errors';

export class S3FileRepository implements FileRepository {
  private readonly options: S3FileConfiguration;
  private readonly s3Instance: S3;

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
      // this is necessary because localstack doesn't support hostnames eg: <bucket>.s3.<region>.amazonaws.com/<key>
      // so it we must use pathStyle buckets eg: localhost:4566/<bucket>/<key>
      forcePathStyle: true,
      // this is necessary to use the localstack instance running on graasp-localstack or localhost
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
    filename,
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
      Object.entries({ item: newId, member: memberId }).filter(([k, v]) => v),
    ) as Record<string, string>;

    const params: CopyObjectCommandInput = {
      CopySource: `${bucket}/${originalPath}`,
      Bucket: bucket,
      Key: newFilePath,
      Metadata: metadata,
      MetadataDirective: 'REPLACE',
      ContentDisposition: contentDisposition(filename),
      ContentType: mimetype,
      CacheControl: 'no-cache', // TODO: improve?
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
            MetadataDirective: 'COPY',
            CacheControl: 'no-cache', // TODO: improve?
          };
          return this.s3Instance.copyObject(params);
        }
      });
      await Promise.all(copyTasks);
    }

    return newFolderPath;
  }

  async deleteFile({ filepath }: { filepath: string }): Promise<void> {
    const { s3Bucket: bucket } = this.options;
    await this.s3Instance.deleteObject({
      Bucket: bucket,
      Key: filepath,
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

  // TODO: split in many functions for simplicity
  async downloadFile({
    expiration,
    filepath,
    fileStorage,
    id,
    reply,
    replyUrl,
  }: {
    expiration?: number;
    filepath: string;
    fileStorage?: string;
    id: UUID;
    reply?: FastifyReply;
    replyUrl?: boolean;
  }) {
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
      });
      const url = await getSignedUrl(this.s3Instance, command, param);

      // Redirect to the object presigned url
      if (reply) {
        if (replyUrl) {
          const replyUrlExpiration = (expiration ?? S3_PRESIGNED_EXPIRATION) - 60;
          reply.header('Cache-Control', `max-age=${replyUrlExpiration}`);
          reply.status(StatusCodes.OK).send(url);
        } else {
          // It is necessary to add the header manually, because the redirect sends the request and
          // when the fastify-cors plugin try to add the header it's already sent and can't add it.
          // So we add it because otherwise the browser won't send the cookie
          reply.header('Access-Control-Allow-Credentials', 'true');
          reply.redirect(url);
        }
      }
      // return readstream of the file saved at given fileStorage path
      else if (fileStorage) {
        // fetch and save file in temporary path
        const res = await fetch(url);
        const tmpPath = path.join(fileStorage, id);
        const fileStream = fs.createWriteStream(tmpPath);
        await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);
          res.body.on('error', reject);
          fileStream.on('finish', resolve);
        });
        fileStream.end();

        // create and return read stream (similar to local file service)
        const file = fs.createReadStream(tmpPath);

        file.on('close', function (err: Error) {
          if (err) {
            console.error(err);
          }
          fs.unlinkSync(tmpPath);
        });

        return file;
      } else {
        return url;
      }
    } catch (e) {
      if (e.statusCode === StatusCodes.NOT_FOUND) {
        throw new S3FileNotFound({ filepath, id });
      }

      throw new DownloadFileUnexpectedError({ filepath, id });
    }
  }

  async getMetadata(key: string): Promise<HeadObjectOutput> {
    const { s3Bucket: Bucket } = this.options;
    const metadata = await this.s3Instance.headObject({ Bucket, Key: key });
    return metadata;
  }

  async uploadFile({
    fileStream,
    memberId,
    filepath,
    mimetype,
  }: {
    fileStream: ReadableStream;
    memberId: string;
    filepath: string;
    mimetype?: string;
    size?: string;
  }): Promise<void> {
    const { s3Bucket: bucket } = this.options;

    const params = {
      Bucket: bucket,
      Key: filepath,
      Metadata: {
        member: memberId,
        // item: id <- cannot add item id
      },
      Body: fileStream,
      ContentType: mimetype,
    };

    const upload = new Upload({
      client: this.s3Instance,
      params: params,
      partSize: 5 * 1024 * 1024, // Minimum part size defined by s3 is 5MB
      queueSize: 1, // This will limit the buffer to the size of one part size
    });

    try {
      await upload.done();

      console.debug('Upload successfully');
    } catch (err) {
      console.error('Something went wrong:', err);
      throw new UploadFileUnexpectedError(err);
    }
  }
}
