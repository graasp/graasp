import { v4 as uuidv4 } from 'uuid';
import { ItemSettings } from '../src/services/items/interfaces/item';

const randomHexOf4 = () => ((Math.random() * (1 << 16)) | 0).toString(16).padStart(4, '0');

export const getDummyItem =
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  (options: { type?: string; parentPath?: string } = {}, extra?) => {
    const { type, parentPath } = options;
    const id = uuidv4();
    let path = id.replace(/-/g, '_');

    if (parentPath) path = `${parentPath}.${path}`;

    return {
      id,
      name: randomHexOf4(),
      description: 'some description',
      type: type || 'itemtype',
      path,
      extra,
      settings: {} as ItemSettings,
      creator: '6c1ab88b-5b39-4c2b-b458-0bf0154c0a2d',
      createdAt: '2021-03-29T08:46:52.939Z',
      updatedAt: '2021-03-29T08:46:52.939Z',
    };
  };
