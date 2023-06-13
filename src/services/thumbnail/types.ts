import { SavedMultipartFile } from '@fastify/multipart';

export type UploadedFile = { fields?: SavedMultipartFile['fields'] } & Pick<
  SavedMultipartFile,
  'filename' | 'mimetype' | 'filepath'
>;
