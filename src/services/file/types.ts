import { UnionOfConst } from '@graasp/sdk';

export type BuildFilePathFunction = (itemId: string, filename: string) => string;

export const FileStorage = {
  Local: 'local',
  S3: 's3',
} as const;
export type FileStorageType = UnionOfConst<typeof FileStorage>;
