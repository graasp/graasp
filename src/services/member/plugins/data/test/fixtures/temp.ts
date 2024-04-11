import { AppDataVisibility } from '@graasp/sdk';

import { Item } from '../../../../../item/entities/Item';
import { AppDataRepository } from '../../../../../item/plugins/app/appData/repository';
import { Member } from '../../../../entities/member';

// TODO: move the originals fixture in a fixture file in the correct folder
// It is necessary to avoid to run the entire tests when importing the utils function from test files:
// /workspace/src/services/item/plugins/app/appAction/test/index.test.ts
// /workspace/src/services/item/plugins/app/appData/test/index.test.ts

export const saveAppData = async ({
  item,
  creator,
  member,
  visibility,
}: {
  item: Item;
  creator: Member;
  member?: Member;
  visibility?: AppDataVisibility;
}) => {
  const defaultData = { type: 'some-type', data: { some: 'data' } };
  const s1 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Item,
  });
  const s2 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Item,
  });
  const s3 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Member,
  });
  const s4 = await AppDataRepository.save({
    item,
    creator,
    member: member ?? creator,
    ...defaultData,
    visibility: visibility ?? AppDataVisibility.Member,
    type: 'other-type',
  });
  return [s1, s2, s3, s4];
};
