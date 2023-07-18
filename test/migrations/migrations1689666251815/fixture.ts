const memberId = '3e901df0-d246-4672-bb01-34269f4c0fed';
const itemId = '1e901df0-d246-4672-bb01-34269f4c0fed';
const incorrectItemId = '2e901df0-d246-4672-bb01-34269f4c0fed';
const itemPath = itemId.replace(/-/g, '_');

const values = {
  member: [
    {
      id: memberId,
      name: 'my member',
      email: 'email@email.com',
      type: 'individual',
      extra: { hasThumbnail: true, favoriteItems: [itemId, itemId, incorrectItemId] }, // migration should handle dupplicated favorites
      created_at: '2022-03-31T13:40:04.571Z',
      updated_at: '2022-03-31T13:40:04.571Z',
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
  ],
  item_tag: [
    {
      id: '1f911df1-d246-d672-bb01-34269f4c0fed',
      type: 'public-item',
      item_path: itemPath,
      creator_id: memberId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
    {
      id: '2f911df1-d246-d672-bb01-34269f4c0fed',
      type: 'published-item',
      item_path: itemPath,
      creator_id: memberId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
    {
      id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      type: 'item-login',
      item_path: itemPath,
      creator_id: memberId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
    {
      id: '4f911df1-d246-d672-bb01-34269f4c0fed',
      type: 'hidden',
      item_path: itemPath,
      creator_id: memberId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
  ],
};

export const up = { values };
