import { v4 as uuidv4 } from 'uuid';
import { UnknownExtra } from '../../src/interfaces/extra';
import { Item } from '../../src/services/items/interfaces/item';
import { buildPathFromId } from '../utils';
import { ACTOR } from './members';
import { ItemSettings } from '../../src/services/items/interfaces/item';

// todo: import types from global constants repo
export const ITEM_TYPES = {
  FOLDER: 'folder',
};

const randomHexOf4 = () => ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');

export const getDummyItem = (
  options: {
    name?: string;
    type?: string;
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
  let buildPath = path ?? buildPathFromId(buildId);

  if (parentPath) buildPath = `${parentPath}.${buildPath}`;

  return {
    id: buildId,
    name: name ?? randomHexOf4(),
    description: description ?? 'some description',
    type: type || 'itemtype',
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
