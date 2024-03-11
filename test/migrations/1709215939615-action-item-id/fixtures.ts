import { DataSource } from 'typeorm';

import { buildPathFromIds } from '@graasp/sdk';

const memberId = '3e901df0-d246-4672-bb01-34269f4c0fed';
const itemId = '1e901df0-d246-4672-bb01-34269f4c0fed';
const itemPath = buildPathFromIds(itemId);
const childItemId = '4e901df0-d246-4672-bb01-34269f4c0fed';
const childItemPath = buildPathFromIds(itemId, childItemId);

const values = {
  member: [
    {
      id: memberId,
      name: 'my member',
      email: 'email@email.com',
      type: 'individual',
      extra: { hasThumbnail: true },
      created_at: '2022-03-31T13:40:04.571Z',
      updated_at: '2022-03-31T13:40:04.571Z',
    },
    {
      id: '0e901df0-d246-4672-bb01-34269f4c0fed',
      name: 'my member with automatic type',
      email: 'email1@email.com',
      extra: {},
      created_at: '2023-03-31T13:40:04.571Z',
      updated_at: '2023-03-31T13:40:04.571Z',
    },
  ],
  item: [
    {
      id: itemId,
      name: 'my item',
      description: 'my description',
      type: 'folder',
      path: itemPath,
      extra: {
        folder: {},
      },
      settings: { hasThumbnail: true },
      creator_id: memberId,
      created_at: '2023-03-31T13:40:04.571Z',
      updated_at: '2023-03-31T13:40:04.571Z',
    },
    {
      id: childItemId,
      name: 'my item',
      description: 'my description',
      type: 'folder',
      path: childItemPath,
      extra: {
        folder: {},
      },
      settings: { hasThumbnail: true },
      creator_id: memberId,
      created_at: '2023-03-31T13:40:04.571Z',
      updated_at: '2023-03-31T13:40:04.571Z',
    },
  ],
  action: [
    {
      id: '0f901df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      member_id: memberId,
      type: 'view',
      view: 'builder',
      extra: { someData: 'invitation name' },
      geolocation: { some: 'geolocation' },
      created_at: '2023-03-31T13:40:04.571Z',
    },
    {
      id: '1f901df1-d246-d672-bb01-34269f4c0fed',
      item_path: childItemPath,
      member_id: memberId,
      type: 'view',
      view: 'builder',
      extra: { someData: 'invitation name' },
      geolocation: { some: 'geolocation' },
      created_at: '2023-03-31T13:40:04.571Z',
    },
  ],
};

export const up = { values };
