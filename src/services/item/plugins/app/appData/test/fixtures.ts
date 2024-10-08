import { v4 } from 'uuid';

import { AppDataVisibility } from '@graasp/sdk';

import { AppDataSource } from '../../../../../../plugins/datasource';
import { Account } from '../../../../../account/entities/account';
import { Member } from '../../../../../member/entities/member';
import { Item } from '../../../../entities/Item';
import { AppData } from '../appData';

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
export const MOCK_APP_ORIGIN = 'https://app.localhost:3000';

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

export const saveAppData = async ({
  item,
  creator,
  account,
  visibility,
}: {
  item: Item;
  creator: Member;
  account?: Account;
  visibility?: AppDataVisibility;
}) => {
  const defaultData = { type: 'some-type', data: { some: 'data' } };
  const appDataRawRepository = AppDataSource.getRepository(AppData);
  const s1 = await appDataRawRepository.save({
    item,
    creator,
    account: account ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Item,
  });
  const s2 = await appDataRawRepository.save({
    item,
    creator,
    account: account ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Item,
  });
  const s3 = await appDataRawRepository.save({
    item,
    creator,
    account: account ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Member,
  });
  const s4 = await appDataRawRepository.save({
    item,
    creator,
    account: account ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Member,
    type: 'other-type',
  });
  return [s1, s2, s3, s4];
};
