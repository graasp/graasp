import { UnionOfConst } from '@graasp/sdk';

export type BuildFilePathFunction = (itemId: string, filename: string) => string;

export const FileStorage = {
  Local: 'local',
  S3: 's3',
};
Object.freeze(FileStorage);
export type FileStorageType = UnionOfConst<typeof FileStorage>;
