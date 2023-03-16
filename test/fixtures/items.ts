import { v4 as uuidv4 } from 'uuid';

import { Item, ItemSettings, ItemType, UnknownExtra, buildPathFromIds } from '@graasp/sdk';

import { ACTOR } from './members';

const randomHexOf4 = () => ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');

export const getDummyItem = (
  options: {
    name?: string;
    type?: Item['type'];
    path?: string;
    description?: string;
    id?: string;
    creator?: string;
    extra?: UnknownExtra;
    parentPath?: string;
    settings?: ItemSettings;
  } = {},
): Item<UnknownExtra> => {
  const {
    type,
    parentPath,
    id,
    description,
    path,
    creator = ACTOR.id,
    extra,
    name,
    settings = {} as ItemSettings,
  } = options;
  const buildId = id ?? uuidv4();
  let buildPath = path ?? buildPathFromIds(buildId);

  if (parentPath) buildPath = `${parentPath}.${buildPath}`;

  return {
    id: buildId,
    name: name ?? randomHexOf4(),
    description: description ?? 'some description',
    type: type || ItemType.FOLDER,
    path: buildPath,
    extra: extra || {},
    creator: creator,
    createdAt: '2021-03-29T08:46:52.939Z',
    updatedAt: '2021-03-29T08:46:52.939Z',
    settings,
  };
};

export const LOTS_OF_ITEMS = [
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
  getDummyItem(),
];
