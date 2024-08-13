import { v4 } from 'uuid';

import { AppDataSource } from '../../../../../../plugins/datasource';
import { Member } from '../../../../../member/entities/member';
import { Item } from '../../../../entities/Item';
import { AppAction } from '../appAction';

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

export const MOCK_APPS = [
  { id: v4(), name: 'some-name', url: 'some-url', description: 'description', extra: {} },
];

export const saveAppActions = async ({ item, member }: { item: Item; member: Member }) => {
  const defaultData = { type: 'some-type', data: { some: 'data' } };
  const rawAppActionRepository = AppDataSource.getRepository(AppAction);

  const s1 = await rawAppActionRepository.save({ item, member, ...defaultData });
  const s2 = await rawAppActionRepository.save({ item, member, ...defaultData });
  const s3 = await rawAppActionRepository.save({ item, member, ...defaultData });
  return [s1, s2, s3];
};
