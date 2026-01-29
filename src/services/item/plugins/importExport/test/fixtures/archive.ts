// content in archive.zip
export const folder = {
  name: 'folder',
  type: 'folder',
  description: 'folder',
  extra: { folder: {} },
};
export const childContent = {
  name: 'img2.png',
  description: '',
  type: 'file',
  extra: { ['file']: { name: 'img2.png', mimetype: 'image/png', size: 4616 } },
};
export const link = {
  name: 'link',
  type: 'embeddedLink',
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
    type: 'app',
    extra: { ['app']: { url: 'https://graasp.org' } },
  },
  {
    name: 'document',
    description: 'document.graasp',
    type: 'document',
    extra: { document: { content: '<p>hello</p>\n' } },
  },
  // s3 file's path is dynamic on upload
  {
    name: 'fixtureUtils.ts',
    description: '',
    type: 'file',
    extra: { file: { name: 'fixtureUtils.ts', mimetype: 'text/plain', size: 337 } },
  },
  {
    name: 'img.png',
    description: 'img.png',
    type: 'file',
    extra: { file: { name: 'img.png', mimetype: 'image/png', size: 4616 } },
  },
  {
    name: 'img_no_extension',
    description: '',
    type: 'file',
    extra: { file: { name: 'img_no_extension', mimetype: 'image/png', size: 4616 } },
  },
];
