import { describe, expect, it } from 'vitest';

import {
  AppItemFactory,
  DocumentItemFactory,
  FileItemFactory,
  FolderItemFactory,
  H5PItemFactory,
  LinkItemFactory,
} from '@graasp/sdk';

import { type ItemRaw } from '../../item';
import { getFilenameFromItem } from './utils';

describe('File name', () => {
  it('get file name from local file item', () => {
    expect(
      getFilenameFromItem(
        FileItemFactory({
          name: 'myfile',
          type: 'file',
          extra: {
            file: {
              name: 'name',
              path: 'path',
              size: 2,
              content: '',
              mimetype: 'image/png',
            },
          },
        }) as unknown as ItemRaw,
      ),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        FileItemFactory({
          name: 'myfile.png',
          type: 'file',
          extra: {
            file: {
              name: 'name',
              path: 'path',
              mimetype: 'image/png',
              size: 2,
              content: '',
            },
          },
        }) as unknown as ItemRaw,
      ),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        FileItemFactory({
          name: 'myfile',
          type: 'file',
          extra: {
            file: {
              name: 'name',
              path: 'path',
              mimetype: 'image/jpeg',
              size: 2,
              content: '',
            },
          },
        }) as unknown as ItemRaw,
      ),
    ).toEqual('myfile.jpeg');
  });
  it('get file name from s3 file item', () => {
    expect(
      getFilenameFromItem({
        name: 'myfile',
        type: 'file',
        extra: {
          file: {
            name: 'name',
            path: 'path',
            mimetype: 'image/png',
            size: 2,
            content: '',
          },
        },
      } as unknown as ItemRaw),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        FileItemFactory({
          name: 'myfile.png',
          type: 'file',
          extra: {
            file: {
              name: 'name',
              path: 'path',
              mimetype: 'image/png',
              size: 2,
              content: '',
            },
          },
        }) as unknown as ItemRaw,
      ),
    ).toEqual('myfile.png');

    expect(
      getFilenameFromItem(
        FileItemFactory({
          name: 'myfile',
          type: 'file',
          extra: {
            file: {
              name: 'name',
              path: 'path',
              mimetype: 'image/jpeg',
              size: 2,
              content: '',
            },
          },
        }) as unknown as ItemRaw,
      ),
    ).toEqual('myfile.jpeg');
  });
  it('get file name from h5p item', () => {
    const item = H5PItemFactory({
      name: 'myh5p',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item)).toEqual('myh5p.h5p');
    const item1 = H5PItemFactory({
      name: 'myh5p.h5p',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item1)).toEqual('myh5p.h5p');
  });
  it('get file name from app item', () => {
    const item = AppItemFactory({
      name: 'myapp',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item)).toEqual('myapp.app');
    const item1 = AppItemFactory({
      name: 'myapp.app',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item1)).toEqual('myapp.app');
  });
  it('get file name from link item', () => {
    const item = LinkItemFactory({
      name: 'mylink',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item)).toEqual('mylink.url');
    const item1 = LinkItemFactory({
      name: 'mylink.url',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item1)).toEqual('mylink.url');
  });
  it('get file name from folder item', () => {
    const item = FolderItemFactory({
      name: 'myfolder',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item)).toEqual('myfolder.zip');
  });
  it('get file name from document item', () => {
    const item = DocumentItemFactory({
      name: 'mydoc',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item)).toEqual('mydoc.html');
    const item1 = DocumentItemFactory({
      name: 'mydoc.graasp',
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item1)).toEqual('mydoc.graasp.html');
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
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item)).toEqual('mydoc.html');
    const item1 = DocumentItemFactory({
      name: 'mydoc.html',
      extra: {
        document: {
          isRaw: true,
          content: 'mycontent',
        },
      },
    }) as unknown as ItemRaw;
    expect(getFilenameFromItem(item1)).toEqual('mydoc.html');
  });
});
