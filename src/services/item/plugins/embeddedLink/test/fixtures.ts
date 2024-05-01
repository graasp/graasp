export const METADATA = {
  title: 'title',
  description: 'description',
};
export const FAKE_URL = 'https://fake-href.local';
const THUMBNAIL_HREF = `${FAKE_URL}/24.png`;
const ICON_HREF = `${FAKE_URL}/icon`;
const HTML = 'html';

export const FETCH_RESULT = {
  meta: METADATA,
  html: HTML,
  links: [
    {
      rel: ['thumbnail'],
      href: THUMBNAIL_HREF,
    },
    {
      rel: ['icon'],
      href: ICON_HREF,
    },
  ],
};

export const expectedResult = {
  title: METADATA.title,
  description: METADATA.description,
  html: HTML,
  thumbnails: [THUMBNAIL_HREF],
  icons: [ICON_HREF],
};
