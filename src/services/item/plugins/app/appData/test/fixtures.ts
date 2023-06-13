import { v4 } from 'uuid';

import { FastifyLoggerInstance } from 'fastify';

export const GRAASP_PUBLISHER_ID = 'publisher-id';

export const MOCK_JWT_SECRET = '1234567890123456789012345678901234567890';

export const MOCK_S3_OPTIONS = {
  s3Region: 's3Region',
  s3Bucket: 's3Bucket',
  s3AccessKeyId: 's3AccessKeyId',
  s3SecretAccessKey: 's3SecretAccessKey',
};
export const MOCK_LOCAL_OPTIONS = {
  storageRootPath: '/storageRootPath',
};
export const MOCK_APP_ORIGIN = 'http://app.localhost:3000';

export const MOCK_TOKEN = 'mock-token';
export const MOCK_CONTEXT = {
  id: v4(),
  name: 'some-name',
  path: 'some-path',
  description: 'some-description',
  type: 'some-type',
  extra: {},
  children: [
    {
      id: v4(),
      name: 'some-name',
      path: 'some-path',
      description: 'some-description',
      type: 'some-type',
    },
  ],
  members: [{ id: v4(), name: 'member-name' }],
};
export const MOCK_SETTINGS = {
  showHeader: true,
};
export const MOCK_APPS = [
  { id: v4(), name: 'some-name', url: 'some-url', description: 'description', extra: {} },
];

// export const buildAppData = ({
//   data = { some: 'value' },
//   memberId = 'memberId',
//   type = 'type',
//   visibility = AppDataVisibility.ITEM,
// }: Partial<AppData> = {}): AppData => ({
//   id: v4(),
//   data,
//   itemId: v4(),
//   createdAt: 'createdAt',
//   updatedAt: 'updatedAt',
//   creator: GRAASP_ACTOR.id,
//   memberId,
//   type,
//   visibility,
// });

export const MOCK_LOGGER = {
  error: jest.fn(),
} as unknown as FastifyLoggerInstance;
