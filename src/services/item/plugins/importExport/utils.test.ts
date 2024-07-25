import {
  AppItemFactory,
  DocumentItemFactory,
  FolderItemFactory,
  H5PItemFactory,
  ItemType,
  LinkItemFactory,
} from '@graasp/sdk';

import { getFilenameFromItem } from './utils';

describe('File name', () => {
  it('get file name from local file item', () => {
    expect(
      getFilenameFromItem({
        name: 'myfile',
        type: ItemType.LOCAL_FILE,
        mimetype: 'image/png',
      }),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem({
        name: 'myfile.png',
        type: ItemType.LOCAL_FILE,
        mimetype: 'image/png',
      }),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem({
        name: 'myfile',
        type: ItemType.LOCAL_FILE,
        mimetype: 'image/jpeg',
      }),
    ).toEqual('myfile.jpeg');
  });
  it('get file name from s3 file item', () => {
    expect(
      getFilenameFromItem({
        name: 'myfile',
        type: ItemType.S3_FILE,
        mimetype: 'image/png',
      }),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem({
        name: 'myfile.png',
        type: ItemType.S3_FILE,
        mimetype: 'image/png',
      }),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem({
        name: 'myfile',
        type: ItemType.S3_FILE,
        mimetype: 'image/jpeg',
      }),
    ).toEqual('myfile.jpeg');
  });
  it('get file name from h5p item', () => {
    const item = H5PItemFactory({
      name: 'myh5p',
    });
    expect(getFilenameFromItem(item)).toEqual('myh5p.h5p');
    const item1 = H5PItemFactory({
      name: 'myh5p.h5p',
    });
    expect(getFilenameFromItem(item1)).toEqual('myh5p.h5p');
  });
  it('get file name from app item', () => {
    const item = AppItemFactory({
      name: 'myapp',
    });
    expect(getFilenameFromItem(item)).toEqual('myapp.app');
    const item1 = AppItemFactory({
      name: 'myapp.app',
    });
    expect(getFilenameFromItem(item1)).toEqual('myapp.app');
  });
  it('get file name from link item', () => {
    const item = LinkItemFactory({
      name: 'mylink',
    });
    expect(getFilenameFromItem(item)).toEqual('mylink.url');
    const item1 = LinkItemFactory({
      name: 'mylink.url',
    });
    expect(getFilenameFromItem(item1)).toEqual('mylink.url');
  });
  it('get file name from folder item', () => {
    const item = FolderItemFactory({
      name: 'myfolder',
    });
    expect(getFilenameFromItem(item)).toEqual('myfolder.zip');
  });
  it('get file name from document item', () => {
    const item = DocumentItemFactory({
      name: 'mydoc',
    });
    expect(getFilenameFromItem(item)).toEqual('mydoc.graasp');
    const item1 = DocumentItemFactory({
      name: 'mydoc.graasp',
    });
    expect(getFilenameFromItem(item1)).toEqual('mydoc.graasp');
  });
});
