import { S3 } from '@aws-sdk/client-s3';

export interface S3FileConfiguration {
  s3Region: string;
  s3Bucket: string;
  s3AccessKeyId: string;
  s3SecretAccessKey: string;
  s3UseAccelerateEndpoint?: boolean;
  s3Expiration?: number;
  s3Instance?: S3;
}

// storageRootPath: absolute path to the root storage
// localFilesHost: host (protocol, domain, and port. Example: http://localhost:3001) of the local server to serve the local files
export interface LocalFileConfiguration {
  storageRootPath: string;
  localFilesHost?: string;
}
