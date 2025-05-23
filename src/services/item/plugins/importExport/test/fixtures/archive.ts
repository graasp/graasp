import { ItemType } from '@graasp/sdk';

// content in archive.zip
export const folder = {
  name: 'folder',
  type: ItemType.FOLDER,
  description: 'folder',
  extra: { folder: {} },
};
export const childContent = {
  name: 'img2.png',
  description: '',
  type: ItemType.FILE,
  extra: { [ItemType.FILE]: { name: 'img2.png', mimetype: 'image/png', size: 4616 } },
};
export const link = {
  name: 'link',
  type: ItemType.LINK,
  description: 'link.url\n',
  extra: { embeddedLink: { url: 'https://graasp.org', description: 'Graasp description' } },
};

export const archive = [
  folder,
  childContent,
  link,
  {
    name: 'app',
    description: 'app.url',
    type: ItemType.APP,
    extra: { [ItemType.APP]: { url: 'https://graasp.org' } },
  },
  {
    name: 'document',
    description: 'document.graasp',
    type: ItemType.DOCUMENT,
    extra: { document: { content: '<p>hello</p>\n' } },
  },
  // s3 file's path is dynamic on upload
  {
    name: 'fixtureUtils.ts',
    description: '',
    type: ItemType.FILE,
    extra: { file: { name: 'fixtureUtils.ts', mimetype: 'text/plain', size: 337 } },
  },
  {
    name: 'img.png',
    description: 'img.png',
    type: ItemType.FILE,
    extra: { file: { name: 'img.png', mimetype: 'image/png', size: 4616 } },
  },
  {
    name: 'img_no_extension',
    description: '',
    type: ItemType.FILE,
    extra: { file: { name: 'img_no_extension', mimetype: 'image/png', size: 4616 } },
  },
];
