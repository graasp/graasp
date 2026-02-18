import {
  AppItemFactory,
  DocumentItemFactory,
  FolderItemFactory,
  ItemType,
  LinkItemFactory,
  LocalFileItemFactory,
  S3FileItemFactory,
} from '@graasp/sdk';

import { Item } from '../../entities/Item';
import { getFilenameFromItem } from './utils';

describe('File name', () => {
  it('get file name from local file item', () => {
    expect(
      getFilenameFromItem(
        LocalFileItemFactory({
          name: 'myfile',
          type: ItemType.LOCAL_FILE,
          extra: {
            file: {
              name: 'name',
              path: 'path',
              size: 2,
              content: '',
              mimetype: 'image/png',
            },
          },
        }) as unknown as Item,
      ),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        LocalFileItemFactory({
          name: 'myfile.png',
          type: ItemType.LOCAL_FILE,
          extra: {
            file: {
              name: 'name',
              path: 'path',
              mimetype: 'image/png',
              size: 2,
              content: '',
            },
          },
        }) as unknown as Item,
      ),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        LocalFileItemFactory({
          name: 'myfile',
          type: ItemType.LOCAL_FILE,
          extra: {
            file: {
              name: 'name',
              path: 'path',
              mimetype: 'image/jpeg',
              size: 2,
              content: '',
            },
          },
        }) as unknown as Item,
      ),
    ).toEqual('myfile.jpeg');
  });
  it('get file name from s3 file item', () => {
    expect(
      getFilenameFromItem({
        name: 'myfile',
        type: ItemType.S3_FILE,
        extra: {
          file: {
            name: 'name',
            path: 'path',
            mimetype: 'image/png',
            size: 2,
            content: '',
          },
        },
      } as unknown as Item),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        S3FileItemFactory({
          name: 'myfile.png',
          type: ItemType.S3_FILE,
          extra: {
            s3File: {
              name: 'name',
              path: 'path',
              mimetype: 'image/png',
              size: 2,
              content: '',
            },
          },
        }) as unknown as Item,
      ),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        S3FileItemFactory({
          name: 'myfile',
          type: ItemType.S3_FILE,
          extra: {
            s3File: {
              name: 'name',
              path: 'path',
              mimetype: 'image/jpeg',
              size: 2,
              content: '',
            },
          },
        }) as unknown as Item,
      ),
    ).toEqual('myfile.jpeg');
  });
  it('get file name from app item', () => {
    const item = AppItemFactory({
      name: 'myapp',
    }) as unknown as Item;
    expect(getFilenameFromItem(item)).toEqual('myapp.app');
    const item1 = AppItemFactory({
      name: 'myapp.app',
    }) as unknown as Item;
    expect(getFilenameFromItem(item1)).toEqual('myapp.app');
  });
  it('get file name from link item', () => {
    const item = LinkItemFactory({
      name: 'mylink',
    }) as unknown as Item;
    expect(getFilenameFromItem(item)).toEqual('mylink.url');
    const item1 = LinkItemFactory({
      name: 'mylink.url',
    }) as unknown as Item;
    expect(getFilenameFromItem(item1)).toEqual('mylink.url');
  });
  it('get file name from folder item', () => {
    const item = FolderItemFactory({
      name: 'myfolder',
    }) as unknown as Item;
    expect(getFilenameFromItem(item)).toEqual('myfolder.zip');
  });
  it('get file name from document item', () => {
    const item = DocumentItemFactory({
      name: 'mydoc',
    }) as unknown as Item;
    expect(getFilenameFromItem(item)).toEqual('mydoc.graasp');
    const item1 = DocumentItemFactory({
      name: 'mydoc.graasp',
    }) as unknown as Item;
    expect(getFilenameFromItem(item1)).toEqual('mydoc.graasp');
  });
  it('get file name from raw document item', () => {
    const item = DocumentItemFactory({
      name: 'mydoc',
      extra: {
        document: {
          isRaw: true,
          content: 'mycontent',
        },
      },
    }) as unknown as Item;
    expect(getFilenameFromItem(item)).toEqual('mydoc.html');
    const item1 = DocumentItemFactory({
      name: 'mydoc.html',
      extra: {
        document: {
          isRaw: true,
          content: 'mycontent',
        },
      },
    }) as unknown as Item;
    expect(getFilenameFromItem(item1)).toEqual('mydoc.html');
  });
});
