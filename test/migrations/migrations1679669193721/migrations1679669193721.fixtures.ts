import { DataSource } from 'typeorm';
import { v4 } from 'uuid';

const memberId = '3e901df0-d246-4672-bb01-34269f4c0fed';
const itemId = '1e901df0-d246-4672-bb01-34269f4c0fed';
const itemPath = itemId.replace(/-/g, '_');

const values = {
  member: [
    {
      id: memberId,
      name: 'my member',
      email: 'email@email.com',
      password: 'mypassword',
      type: 'individual',
      extra: { hasThumbnail: true },
    },
    {
      id: '0e901df0-d246-4672-bb01-34269f4c0fed',
      name: 'my member with automatic type',
      email: 'email1@email.com',
      extra: {},
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
      creator: memberId,
    },
  ],
};

// types will be outdated so we don't use them
const expected = {
  member: async (m: any, idx: number, db: DataSource) => {
    const expected = values.member[idx];
    console.log(idx, m, expected);
    expect(m.id).toEqual(expected.id);
    expect(m.name).toEqual(expected.name);
    expect(m.email).toEqual(expected.email);
    // extra changed type
    expect(JSON.parse(m.extra)).toEqual(expected.extra);
    expect(m.type).toEqual(expected.type ?? 'individual');
    expect(m.created_at).toBeTruthy();
    expect(m.updated_at).toBeTruthy();

    // password moved to another table
    if (m.password) {
      const [password] = await db.query(
        `SELECT * from member_password WHERE member_id='${expected.id}'`,
      );
      expect(m.password).toBeFalsy();
      expect(password.password).toEqual(expected.password);
    }
  },
  item: async (item: any, idx: number) => {
    console.log(item, idx);
    expect(item.id).toEqual(itemId);
    expect(item.name).toEqual(values.item[idx].name);
    expect(item.creator_id).toEqual(values.item[idx].creator);
    expect(item.description).toEqual(values.item[idx].description);
    // extra changed type
    expect(JSON.parse(item.extra)).toEqual(values.item[idx].extra);
    // settings changed type
    expect(JSON.parse(item.settings)).toEqual(values.item[idx].settings);
    expect(item.path).toEqual(values.item[idx].path);
    expect(item.created_at).toBeTruthy();
    expect(item.updated_at).toBeTruthy();
    // new column
    expect(item.deleted_at).toBeNull();
  },
};

export const up = { values, expected };

const downValues = {
  member: [
    {
      id: memberId,
      name: 'my member',
      email: 'email@email.com',
      type: 'individual',
      extra: { hasThumbnail: true },
    },
    {
      id: '0e901df0-d246-4672-bb01-34269f4c0fed',
      name: 'my member with automatic type',
      email: 'email1@email.com',
      extra: {},
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
    },
  ],
  member_password: [
    {
      id: '0e901df0-d243-4672-bb01-34269f4c0fed',
      password: 'mypassword',
      member_id: memberId,
    },
  ],
};

// types will be outdated so we don't use them
const downExpected = {
  member: async (m: any, idx: number, db: DataSource) => {
    const expected = downValues.member[idx];
    console.log(idx, m, expected);
    expect(m.id).toEqual(expected.id);
    expect(m.name).toEqual(expected.name);
    expect(m.email).toEqual(expected.email);
    // extra changed type
    expect(m.extra).toEqual(expected.extra);
    expect(m.type).toEqual(expected.type ?? 'individual');
    expect(m.created_at).toBeTruthy();
    expect(m.updated_at).toBeTruthy();

    // password back in table
    console.log(downValues.member_password, m.id);
    if (m.password) {
      const password = downValues.member_password.find((d) => d.member_id === m.id)?.password;
      expect(m.password).toContain(password);
    }
  },
  item: async (item: any, idx: number) => {
    const expected = downValues.item[idx];
    expect(item.id).toEqual(itemId);
    expect(item.name).toEqual(expected.name);
    expect(item.creator).toEqual(expected.creator_id);
    expect(item.description).toEqual(expected.description);
    // extra changed type
    expect(item.extra).toEqual(expected.extra);
    // settings changed type
    expect(item.settings).toEqual(expected.settings);
    expect(item.path).toEqual(expected.path);
    expect(item.created_at).toBeTruthy();
    expect(item.updated_at).toBeTruthy();
    // new column
    expect(item.deleted_at).toBeUndefined();
  },
};

export const down = { values: downValues, expected: downExpected };
