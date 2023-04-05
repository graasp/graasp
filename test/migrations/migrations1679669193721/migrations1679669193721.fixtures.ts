import { DataSource, Db } from 'typeorm';
import { v4 } from 'uuid';

import { getTableNames } from '../utils';

const memberId = '3e901df0-d246-4672-bb01-34269f4c0fed';
const itemId = '1e901df0-d246-4672-bb01-34269f4c0fed';
const itemPath = itemId.replace(/-/g, '_');
const recycledItemId = '5e901df0-d246-4672-bb01-34269f4c0fed';
const recycledItemPath = recycledItemId.replace(/-/g, '_');
const itemLoginItemId = '9e901df0-d246-4672-bb01-34269f4c0fed';
const itemLoginItemPath = itemLoginItemId.replace(/-/g, '_');

const values = {
  member: [
    {
      id: memberId,
      name: 'my member',
      email: 'email@email.com',
      password: 'mypassword',
      type: 'individual',
      extra: { hasThumbnail: true, itemLogin: { password: 'mypassword' } },
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
      creator: memberId,
      created_at: '2023-03-31T13:40:04.571Z',
      updated_at: '2023-03-31T13:40:04.571Z',
    },
    {
      id: recycledItemId,
      name: 'my item',
      description: 'my description',
      type: 'folder',
      path: recycledItemPath,
      extra: {
        folder: {},
      },
      settings: { hasThumbnail: true },
      creator: memberId,
      created_at: '2023-03-31T13:40:04.571Z',
      updated_at: '2023-03-31T13:40:04.571Z',
    },
    {
      id: itemLoginItemId,
      name: 'my item with item login',
      description: 'my description',
      type: 'folder',
      path: itemLoginItemPath,
      extra: {
        itemLogin: {
          loginSchema: 'username',
        },
      },
      settings: {},
      creator: memberId,
      created_at: '2023-01-31T13:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
  ],
  item_membership: [
    {
      id: '0e901df0-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      member_id: memberId,
      permission: 'write',
      creator: memberId,
      created_at: '2023-01-31T13:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
    {
      id: '0e901df3-d246-d672-bb01-34269f4c0fed',
      item_path: itemLoginItemPath,
      member_id: memberId,
      permission: 'write',
      creator: memberId,
      created_at: '2023-01-31T13:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
  ],
  invitation: [
    {
      id: '0e901df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      email: 'someemail@emfil.com',
      permission: 'write',
      name: 'invitation name',
      creator: memberId,
      created_at: '2023-01-31T12:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
  ],
  // TODO
  // action: [
  //   {
  //     id: '0f901df1-d246-d672-bb01-34269f4c0fed',
  //     item_path: itemPath,
  //     member_id: memberId,
  //     item_type: 'folder',
  //     action_type: 'view',
  //     member_type: 'individual',
  //     view: 'builder',
  //     extra: { someData: 'invitation name' },
  //     geolocation: { some: 'geolocation' },
  //     created_at:'2023-03-31T13:40:04.571Z',
  //   },
  // ],
  // action_request_export: [
  //   {
  //     id: '0f901df1-d246-d671-bb01-34269f4c0fed',
  //     member_id: memberId,
  //     item_id: itemId,
  //     created_at:'2022-03-31T12:40:04.571Z',
  //   },
  // ],
  recycled_item: [
    {
      id: '3f901df1-d246-d672-bb01-34269f4c0fed',
      item_path: recycledItemPath,
      item_id: itemId,
      creator: memberId,
      created_at: '2021-05-31T12:40:04.571Z',
    },
  ],
  tag: [
    {
      id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      name: 'mytag',
      nested: 'allow',
      created_at: '2021-05-31T12:40:04.571Z',
    },
    {
      id: 'ea9a3b4e-7b67-44c2-a9df-528b6ae5424f',
      name: 'published-item',
      nested: 'allow',
      created_at: '2021-05-31T12:40:04.571Z',
    },
  ],
  item_tag: [
    {
      id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      tag_id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      creator: memberId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
    {
      id: '3f911df2-d246-d672-bb01-34269f4c0fed',
      tag_id: 'ea9a3b4e-7b67-44c2-a9df-528b6ae5424f',
      item_path: itemPath,
      creator: memberId,
      created_at: '2021-03-31T14:40:04.571Z',
    },
  ],
  category_type: [
    {
      id: '3f7b79e2-7e78-4aef-b697-2b6a6ba92e91',
      name: 'discipline',
    },
  ],
  category: [
    {
      id: '4f7b79e2-7e78-4aea-b697-2b6a6ba92e91',
      name: 'Kindergarden',
      type: '3f7b79e2-7e78-4aef-b697-2b6a6ba92e91',
    },
  ],
  item_category: [
    {
      id: 'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      item_id: itemId,
      category_id: '4f7b79e2-7e78-4aea-b697-2b6a6ba92e91',
    },
  ],
  item_validation_process: [
    {
      id: 'c244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      name: 'bad-words-detection',
      description: 'check all text fields for bad words',
      enabled: true,
    },
  ],
  item_validation_status: [
    {
      id: 'a244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      name: 'pending',
    },
    {
      id: 'a244bf4f-19e0-4675-b2a2-06bb5ac6e11c',
      name: 'failure',
    },
  ],
  item_validation: [
    {
      id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      item_id: itemId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
  ],
  item_validation_group: [
    {
      id: 'e244bf4f-19e0-4674-b2a2-06bb5ac6e11d',
      item_id: itemId,
      item_validation_id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      item_validation_process_id: 'c244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      status_id: 'a244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      result: 'myresult',
      created_at: '2022-05-31T12:20:04.571Z',
      updated_at: '2022-05-21T12:40:04.571Z',
    },
    {
      id: '1244bf4f-19e0-4674-b2a2-06bb5ac6e11d',
      item_id: itemId,
      item_validation_id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      item_validation_process_id: 'c244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      status_id: 'a244bf4f-19e0-4675-b2a2-06bb5ac6e11c',
      result: 'myresult',
      created_at: '2022-01-31T12:20:04.571Z',
      updated_at: '2022-01-21T12:40:04.571Z',
    },
  ],
  item_validation_review_status: [
    {
      id: 'e244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      name: 'pending',
    },
  ],
  item_validation_review: [
    {
      id: 'ae901df0-d246-4673-bb01-34269f4c0fed',
      item_validation_id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      reviewer_id: memberId,
      status_id: 'e244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      reason: 'myreason',
      created_at: '2022-05-31T12:40:04.571Z',
      updated_at: '2022-05-31T12:40:04.571Z',
    },
  ],
  item_member_login: [
    {
      item_id: itemLoginItemId,
      member_id: memberId,
      created_at: '2022-05-21T12:40:04.571Z',
    },
  ],
  chat_message: [
    {
      id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      chat_id: itemId,
      creator: memberId,
      body: 'mymessage',
      created_at: '2021-05-31T12:20:04.571Z',
      updated_at: '2021-05-21T12:40:04.571Z',
    },
  ],
  chat_mention: [
    {
      id: 'e244ef4f-39e1-4672-b2a2-06bb5ac6e11c',
      item_path: itemPath,
      message_id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      member_id: memberId,
      creator: memberId,
      status: 'read',
      created_at: '2023-01-31T12:20:04.571Z',
      updated_at: '2023-01-21T12:40:04.571Z',
    },
    // default status value
    {
      id: 'e244bf4f-39e1-4672-b2a2-06bb3ac6e11c',
      item_path: itemPath,
      message_id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      member_id: memberId,
      creator: memberId,
      created_at: '2023-03-31T12:20:04.571Z',
      updated_at: '2023-03-21T12:40:04.571Z',
    },
  ],
  flag: [
    {
      id: 'e244bf4f-39e2-4672-b2a2-06bb3ac6e11c',
      name: 'flag',
    },
  ],
  item_flag: [
    {
      id: 'e245bf4f-39e2-4672-b2a2-06bb3ac6e11c',
      flag_id: 'e244bf4f-39e2-4672-b2a2-06bb3ac6e11c',
      item_id: itemId,
      creator: memberId,
      created_at: '2023-01-31T12:10:04.571Z',
    },
  ],
  publisher: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e11c',
      name: 'mypublisher',
      origins: ['someorigin'],
      created_at: '2023-01-31T12:10:04.571Z',
    },
  ],
  app: [
    {
      id: 'e245bf4f-32a2-4672-b2a2-06bb3ac6e11c',

      name: 'myapp',
      description: 'my description',

      url: 'myurl',
      publisher_id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e11c',

      extra: {
        image: 'url',
      },
      created_at: '2022-01-31T12:10:04.571Z',
    },
  ],
  app_data: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
      data: { some: 'data' },
      type: 'some type',

      creator: memberId,

      visibility: 'member',
      created_at: '2022-01-31T12:10:04.571Z',
      updated_at: '2022-03-21T12:40:04.571Z',
    },
  ],
  app_action: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
      data: { some: 'data' },
      type: 'some type',
      created_at: '2022-03-31T12:10:04.571Z',
    },
  ],
  app_setting: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      creator: memberId,
      item_id: itemId,
      data: { some: 'data' },
      name: 'some type',
      created_at: '2022-02-11T11:10:04.571Z',
      updated_at: '2022-03-21T11:40:04.571Z',
    },
  ],
  item_like: [
    {
      id: 'e245af4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
      created_at: '2022-02-11T12:11:04.571Z',
    },
  ],
};

// types will be outdated so we don't use them
const expected = {
  member: async (m: any, idx: number, db: DataSource) => {
    const expected = values.member[idx];
    expect(m.id).toEqual(expected.id);
    expect(m.name).toEqual(expected.name);
    expect(m.email).toEqual(expected.email);
    // extra changed type
    expect(JSON.parse(m.extra)).toEqual(expected.extra);
    expect(m.type).toEqual(expected.type ?? 'individual');
    expect(m.created_at.toISOString()).toEqual(expected.created_at);
    expect(m.updated_at.toISOString()).toEqual(expected.updated_at);

    // password moved to another table
    if (m.password) {
      const [password] = await db.query(
        `SELECT * from member_password WHERE member_id='${expected.id}'`,
      );
      expect(m.password).toBeFalsy();
      expect(password.password).toEqual(expected.password);
    }
  },
  item: async (item: any, idx: number, db: DataSource) => {
    const expected = values.item[idx];
    expect(item.id).toEqual(expected.id);
    expect(item.name).toEqual(expected.name);
    expect(item.creator_id).toEqual(expected.creator);
    expect(item.description).toEqual(expected.description);
    // extra changed type
    expect(JSON.parse(item.extra)).toEqual(expected.extra);
    // settings changed type
    expect(JSON.parse(item.settings)).toEqual(expected.settings);
    expect(item.path).toEqual(expected.path);
    expect(item.created_at.toISOString()).toEqual(expected.created_at);
    expect(item.updated_at.toISOString()).toEqual(expected.created_at);

    // deleted column
    const [deleted] = await db.query(
      `SELECT * from recycled_item_data WHERE item_path='${expected.path}'`,
    );
    if (deleted) {
      expect(item.deleted_at).toEqual(deleted.created_at);
    }
  },
  item_membership: async (im: any, idx: number) => {
    const expected = values.item_membership[idx];

    expect(im.id).toEqual(expected.id);
    expect(im.item_path).toEqual(expected.item_path);
    expect(im.creator_id).toEqual(expected.creator);
    expect(im.member_id).toEqual(expected.member_id);
    expect(im.created_at.toISOString()).toEqual(expected.created_at);
    expect(im.updated_at.toISOString()).toEqual(expected.created_at);
  },
  invitation: async (invitation: any, idx: number) => {
    const expected = values.invitation[idx];
    expect(invitation.id).toEqual(expected.id);
    expect(invitation.item_path).toEqual(expected.item_path);
    expect(invitation.creator_id).toEqual(expected.creator);
    expect(invitation.email).toEqual(expected.email);
    expect(invitation.name).toEqual(expected.name);
    expect(invitation.permission).toEqual(expected.permission);
    expect(invitation.created_at.toISOString()).toEqual(expected.created_at);
    expect(invitation.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  // TODO
  // action: async (action: any, idx: number) => {
  //   const expected = values.action[idx];
  //   expect(action.id).toEqual(expected.id);
  //   expect(action.item_id).toEqual(expected.item_path);
  //   expect(action.member_id).toEqual(expected.member_id);
  //   expect(action.geolocation).toEqual(expected.geolocation);
  //   expect(action.type).toEqual(expected.action_type);
  //   expect(action.extra).toEqual(expected.extra);
  //   expect(action.view).toEqual(expected.view);
  //   expect(action.created_at.toISOString()).toEqual(expected.created_at);
  // },
  // action_request_export: async (a: any, idx: number) => {
  //   const expected = values.action_request_export[idx];
  //   expect(a.id).toEqual(expected.id);
  //   expect(a.item_id).toEqual(expected.item_id);
  //   expect(a.member_id).toEqual(expected.member_id);
  //   expect(a.created_at.toISOString()).toEqual(expected.created_at);
  // },
  recycled_item: async (recycledItem: any, idx: number, db: DataSource) => {
    const expected = values.recycled_item[idx];

    // table changed name
    const [newRecycledItem] = await db.query(
      `SELECT * FROM recycled_item_data WHERE id= '${expected.id}'`,
    );
    expect(newRecycledItem.id).toEqual(expected.id);
    expect(newRecycledItem.item_path).toEqual(expected.item_path);
    expect(newRecycledItem.creator_id).toEqual(expected.creator);
    expect(newRecycledItem.created_at.toISOString()).toEqual(expected.created_at);
  },
  tag: async (tag: any, idx: number, db: DataSource) => {
    // we removed this table
    const result = await getTableNames(db);
    expect(result).not.toContain('tag');
  },
  item_tag: async (itemTag: any, idx: number, db: DataSource) => {
    const expected = values.item_tag[idx];
    const type = await values.tag.find(({ id }) => id === expected.tag_id)?.name;
    expect(itemTag.id).toEqual(expected.id);
    expect(itemTag.type).toEqual(type);
    expect(itemTag.creator_id).toEqual(expected.creator);
    expect(itemTag.created_at.toISOString()).toEqual(expected.created_at);

    // item_published
    if (expected.tag_id === 'ea9a3b4e-7b67-44c2-a9df-528b6ae5424f') {
      const [itemPublished] = await db.query(
        `SELECT * FROM item_published WHERE item_path= '${expected.item_path}'`,
      );
      expect(itemPublished.id).toBeTruthy();
      expect(itemPublished.creator_id).toEqual(itemTag.creator);
      expect(itemPublished.created_at).toEqual(itemTag.created_at);
    }
  },
  category_type: async (ct: any, idx: number, db: DataSource) => {
    // we removed this table
    const result = await getTableNames(db);
    expect(result).not.toContain('category_type');
  },
  category: async (c: any, idx: number, db: DataSource) => {
    const expected = values.category[idx];
    const type = values.category_type.find(({ id }) => expected.type === id)?.name;
    expect(c.id).toEqual(expected.id);
    expect(c.name).toEqual(expected.name);
    expect(c.type).toEqual(type);
  },
  item_category: async (ic: any, idx: number) => {
    const expected = values.item_category[idx];
    const path = values.item.find(({ id }) => expected.item_id === id)?.path;
    expect(ic.id).toEqual(expected.id);
    expect(ic.category_id).toEqual(expected.category_id);
    expect(ic.item_path).toEqual(path);
  },
  item_validation_process: async (ivp: any, idx: number, db: DataSource) => {
    // we removed this table
    const result = await getTableNames(db);
    expect(result).not.toContain('item_validation_process');
  },
  item_validation_status: async (ivs: any, idx: number, db: DataSource) => {
    // we removed this table
    const result = await getTableNames(db);
    expect(result).not.toContain('item_validation_status');
  },
  // item validation becomes item validation group
  item_validation: async (iv: any, idx: number, db: DataSource) => {
    const expected = values.item_validation[idx];
    const [ivg] = await db.query(`SELECT * FROM item_validation_group WHERE id= '${expected.id}'`);
    expect(ivg.id).toEqual(expected.id);
    expect(ivg.item_id).toEqual(expected.item_id);
    expect(ivg.created_at.toISOString()).toEqual(expected.created_at);
  },
  item_validation_review_status: async (ivrs: any, idx: number, db: DataSource) => {
    // we removed this table
    const result = await getTableNames(db);
    expect(result).not.toContain('item_validation_review_status');
  },
  item_validation_review: async (_ivr: any, _idx: number, db: DataSource) => {
    // empty db
    const rows = await db.query('SELECT * FROM item_validation_review');
    expect(rows).toHaveLength(0);
  },
  item_validation_group: async (ivg: any, idx: number, db: DataSource) => {
    const expected = values.item_validation_group[idx];
    const [iv] = await db.query(`SELECT * FROM item_validation WHERE id= '${expected.id}'`);
    const processName = values.item_validation_process.find(
      ({ id }) => id === expected.item_validation_process_id,
    )?.name;
    const statusName = values.item_validation_status.find(
      ({ id }) => id === expected.status_id,
    )?.name;
    expect(iv.id).toEqual(expected.id);
    expect(iv.item_id).toEqual(expected.item_id);
    expect(iv.item_validation_group_id).toEqual(expected.item_validation_id);
    expect(iv.process).toEqual(processName);
    expect(iv.status).toEqual(statusName);
    expect(iv.result).toEqual(expected.result);
    expect(iv.created_at.toISOString()).toEqual(expected.created_at);
    expect(iv.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  item_member_login: async (_iml: any, idx: number, db: DataSource) => {
    // table changed -> item_login and item_login_schema
    const expected = values.item_member_login[idx];

    const item = values.item.find(({ id }) => id === expected.item_id);
    const [ils] = await db.query(
      `SELECT * FROM item_login_schema WHERE item_path= '${item?.path}'`,
    );
    expect(ils.id).toBeTruthy();
    expect(ils.item_path).toEqual(item?.path);
    expect(ils.type).toEqual((item?.extra as any)?.itemLogin?.loginSchema);
    expect(ils.created_at.toISOString()).toBeTruthy();
    expect(ils.updated_at.toISOString()).toBeTruthy();

    const [il] = await db.query(
      `SELECT * FROM item_login WHERE member_id= '${expected.member_id}' AND item_login_schema_id= '${ils.id}'`,
    );
    const [member] = await db.query(`SELECT * FROM member WHERE id= '${expected.member_id}' `);
    const [membership] = await db.query(
      `SELECT * FROM item_membership WHERE member_id= '${expected.member_id}' AND  item_path= '${item?.path}' `,
    );
    expect(il.id).toBeTruthy();
    expect(il.member_id).toEqual(expected.member_id);
    expect(il.password).toEqual(JSON.parse(member?.extra)?.itemLogin?.password);
    expect(il.item_login_schema_id).toEqual(ils.id);
    expect(il.created_at).toEqual(membership.created_at);
    expect(il.updated_at).toEqual(membership.created_at);
  },
  chat_message: async (cm: any, idx: number) => {
    const expected = values.chat_message[idx];
    expect(cm.id).toEqual(expected.id);
    expect(cm.item_id).toEqual(expected.chat_id);
    expect(cm.creator_id).toEqual(expected.creator);
    expect(cm.body).toEqual(expected.body);
    expect(cm.created_at.toISOString()).toEqual(expected.created_at);
    expect(cm.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  chat_mention: async (cm: any, idx: number) => {
    const expected = values.chat_mention[idx];
    expect(cm.id).toEqual(expected.id);
    expect(cm.message_id).toEqual(expected.message_id);
    expect(cm.member_id).toEqual(expected.member_id);
    expect(cm.status).toEqual(expected.status ?? 'unread');
    expect(cm.created_at.toISOString()).toEqual(expected.created_at);
    expect(cm.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  flag: async (flag: any, idx: number, db: DataSource) => {
    // we removed this table
    const result = await getTableNames(db);
    expect(result).not.toContain('flag');
  },
  item_flag: async (iflag: any, idx: number) => {
    const expected = values.item_flag[idx];
    const flag = values.flag.find(({ id }) => id === expected.flag_id);
    expect(iflag.id).toEqual(expected.id);
    expect(iflag.type).toEqual(flag?.name);
    expect(iflag.item_id).toEqual(expected.item_id);
    expect(iflag.creator_id).toEqual(expected.creator);
    expect(iflag.created_at.toISOString()).toEqual(expected.created_at);
  },
  publisher: async (p: any, idx: number) => {
    const expected = values.publisher[idx];
    expect(p.id).toEqual(expected.id);
    expect(p.name).toEqual(expected.name);
    expect(p.origins).toEqual(expected.origins);
    expect(p.created_at.toISOString()).toEqual(expected.created_at);
  },
  app: async (a: any, idx: number) => {
    const expected = values.app[idx];
    expect(a.id).toEqual(expected.id);
    expect(a.name).toEqual(expected.name);
    expect(a.description).toEqual(expected.description);
    expect(a.url).toEqual(expected.url);
    expect(a.publisher_id).toEqual(expected.publisher_id);
    expect(JSON.parse(a.extra)).toEqual(expected.extra);
    expect(a.created_at.toISOString()).toEqual(expected.created_at);
  },
  app_data: async (ad: any, idx: number) => {
    const expected = values.app_data[idx];
    expect(ad.id).toEqual(expected.id);
    expect(ad.member_id).toEqual(expected.member_id);
    expect(ad.item_id).toEqual(expected.item_id);
    expect(ad.creator_id).toEqual(expected.creator);
    expect(ad.type).toEqual(expected.type);
    expect(ad.visibility).toEqual(expected.visibility);
    expect(JSON.parse(ad.data)).toEqual(expected.data);
    expect(ad.created_at.toISOString()).toEqual(expected.created_at);
  },
  app_action: async (aa: any, idx: number) => {
    const expected = values.app_action[idx];
    expect(aa.id).toEqual(expected.id);
    expect(aa.member_id).toEqual(expected.member_id);
    expect(aa.item_id).toEqual(expected.item_id);
    expect(aa.type).toEqual(expected.type);
    expect(JSON.parse(aa.data)).toEqual(expected.data);
    expect(aa.created_at.toISOString()).toEqual(expected.created_at);
  },
  app_setting: async (as: any, idx: number) => {
    const expected = values.app_setting[idx];
    expect(as.id).toEqual(expected.id);
    expect(as.creator_id).toEqual(expected.creator);
    expect(as.item_id).toEqual(expected.item_id);
    expect(as.name).toEqual(expected.name);
    expect(JSON.parse(as.data)).toEqual(expected.data);
    expect(as.created_at.toISOString()).toEqual(expected.created_at);
    expect(as.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  item_like: async (il: any, idx: number) => {
    const expected = values.item_like[idx];
    expect(il.id).toEqual(expected.id);
    expect(il.creator_id).toEqual(expected.member_id);
    expect(il.item_id).toEqual(expected.item_id);
    expect(il.created_at.toISOString()).toEqual(expected.created_at);
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
      extra: { hasAvatar: true },
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
    {
      id: recycledItemId,
      name: 'my item',
      description: 'my description',
      type: 'folder',
      path: recycledItemPath,
      extra: {
        folder: {},
      },
      settings: { hasThumbnail: true },
      creator_id: memberId,
      created_at: '2023-03-31T13:40:04.571Z',
      updated_at: '2023-03-31T13:40:04.571Z',
    },
    {
      id: itemLoginItemId,
      name: 'my item with item login',
      description: 'my description',
      type: 'folder',
      path: itemLoginItemPath,
      extra: {},
      settings: {},
      creator_id: memberId,
      created_at: '2023-01-31T13:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
  ],
  member_password: [
    {
      id: '0e901df0-d243-4672-bb01-34269f4c0fed',
      password: 'mypassword',
      member_id: memberId,
    },
  ],
  item_membership: [
    {
      id: '0e901df0-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      member_id: memberId,
      permission: 'write',
      creator_id: memberId,
      created_at: '2023-01-31T13:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
    {
      id: '0e901df3-d246-d672-bb01-34269f4c0fed',
      item_path: itemLoginItemPath,
      member_id: memberId,
      permission: 'write',
      creator_id: memberId,
      created_at: '2023-01-31T13:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
  ],
  invitation: [
    {
      id: '0e901df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      email: 'someemail@emfil.com',
      permission: 'write',
      name: 'invitation name',
      creator_id: memberId,
      created_at: '2023-01-31T12:40:04.571Z',
      updated_at: '2023-01-31T13:40:04.571Z',
    },
  ],
  // TODO
  // action: [
  //   {
  //     id: '0f901df1-d246-d672-bb01-34269f4c0fed',
  //     item_path: itemPath,
  //     member_id: memberId,
  //     item_type: 'folder',
  //     action_type: 'view',
  //     member_type: 'individual',
  //     view: 'builder',
  //     extra: { someData: 'invitation name' },
  //     geolocation: { some: 'geolocation' },
  //     created_at:'2023-03-31T13:40:04.571Z',
  //   },
  // ],
  // action_request_export: [
  //   {
  //     id: '0f901df1-d246-d671-bb01-34269f4c0fed',
  //     member_id: memberId,
  //     item_id: itemId,
  //     created_at:'2022-03-31T12:40:04.571Z',
  //   },
  // ],
  item_published: [
    {
      id: '3f901df1-d246-d671-bb01-34269f4c0fed',
      item_path: itemPath,
      creator_id: memberId,
      created_at: '2022-05-31T12:40:04.571Z',
    },
  ],
  recycled_item_data: [
    {
      id: '3f901df1-d246-d672-bb01-34269f4c0fed',
      item_path: recycledItemPath,
      creator_id: memberId,
      created_at: '2021-05-31T12:40:04.571Z',
    },
  ],
  item_tag: [
    {
      id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      type: 'public',
      item_path: itemPath,
      creator_id: memberId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
  ],
  category: [
    {
      id: '4f7b79e2-7e78-4aea-b697-2b6a6ba92e91',
      name: 'Kindergarden',
      type: 'discipline',
    },
  ],
  item_category: [
    {
      id: 'c344bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      item_path: itemPath,
      category_id: '4f7b79e2-7e78-4aea-b697-2b6a6ba92e91',
    },
  ],
  item_validation_group: [
    {
      id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      item_id: itemId,
      created_at: '2021-03-31T12:40:04.571Z',
    },
  ],
  item_validation: [
    {
      id: 'e244bf4f-19e0-4674-b2a2-06bb5ac6e11d',
      item_id: itemId,
      item_validation_group_id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      process: 'myprocess',
      status: 'pending',
      result: 'myresult',
      created_at: '2022-05-31T12:20:04.571Z',
      updated_at: '2022-05-21T12:40:04.571Z',
    },
    {
      id: '1244bf4f-19e0-4674-b2a2-06bb5ac6e11d',
      item_id: itemId,
      item_validation_group_id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      process: 'myprocess1',
      status: 'failure',
      result: 'myresult',
      created_at: '2022-01-31T12:20:04.571Z',
      updated_at: '2022-01-21T12:40:04.571Z',
    },
  ],
  item_validation_review: [
    {
      id: 'ae901df0-d246-4673-bb01-34269f4c0fed',
      item_validation_id: '1244bf4f-19e0-4674-b2a2-06bb5ac6e11d',
      reviewer_id: memberId,
      status: 'pending',
      reason: 'myreason',
      created_at: '2022-05-31T12:40:04.571Z',
      updated_at: '2022-05-31T12:40:04.571Z',
    },
  ],
  item_login_schema: [
    {
      id: 'af901df0-d246-4673-bb01-34269f4c0fed',
      item_path: itemLoginItemPath,
      type: 'username',
      created_at: '2022-05-21T12:40:04.571Z',
      updated_at: '2022-05-21T12:40:04.571Z',
    },
  ],
  item_login: [
    {
      id: 'af901df1-d246-4673-bb01-34269f4c0fed',
      item_login_schema_id: 'af901df0-d246-4673-bb01-34269f4c0fed',
      member_id: memberId,
      password: 'mypassworditemlogin',
      created_at: '2022-05-21T12:40:04.571Z',
      updated_at: '2022-05-21T12:40:04.571Z',
    },
  ],
  chat_message: [
    {
      id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      item_id: itemId,
      creator_id: memberId,
      body: 'mymessage',
      created_at: '2021-05-31T12:20:04.571Z',
      updated_at: '2021-05-21T12:40:04.571Z',
    },
  ],
  chat_mention: [
    {
      id: 'e244ef4f-39e1-4672-b2a2-06bb5ac6e11c',
      message_id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      member_id: memberId,
      status: 'read',
      created_at: '2023-01-31T12:20:04.571Z',
      updated_at: '2023-01-21T12:40:04.571Z',
    },
    // default status value
    {
      id: 'e244bf4f-39e1-4672-b2a2-06bb3ac6e11c',
      message_id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      member_id: memberId,
      created_at: '2023-03-31T12:20:04.571Z',
      updated_at: '2023-03-21T12:40:04.571Z',
    },
  ],
  item_flag: [
    {
      id: 'e245bf4f-39e2-4672-b2a2-06bb3ac6e11c',
      type: 'myflag',
      item_id: itemId,
      creator_id: memberId,
      created_at: '2023-01-31T12:10:04.571Z',
    },
  ],
  publisher: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e11c',
      name: 'mypublisher',
      origins: ['someorigin'],
      created_at: '2023-01-31T12:10:04.571Z',
    },
  ],
  app: [
    {
      id: 'e245bf4f-32a2-4672-b2a2-06bb3ac6e11c',
      name: 'myapp',
      description: 'my description',
      url: 'myurl',
      publisher_id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e11c',
      extra: {
        image: 'url',
      },
      created_at: '2022-01-31T12:10:04.571Z',
    },
  ],
  app_data: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
      data: { some: 'data' },
      type: 'some type',
      creator_id: memberId,
      visibility: 'member',
      created_at: '2022-01-31T12:10:04.571Z',
      updated_at: '2022-03-21T12:40:04.571Z',
    },
  ],
  app_action: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
      data: { some: 'data' },
      type: 'some type',
      created_at: '2022-03-31T12:10:04.571Z',
    },
  ],
  app_setting: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      creator_id: memberId,
      item_id: itemId,
      data: { some: 'data' },
      name: 'some type',
      created_at: '2022-02-11T11:10:04.571Z',
      updated_at: '2022-03-21T11:40:04.571Z',
    },
  ],
  item_like: [
    {
      id: 'e245af4f-32e2-4672-b2a2-06bb3ac6e12c',
      creator_id: memberId,
      item_id: itemId,
      created_at: '2022-02-11T12:11:04.571Z',
    },
  ],
};

// types will be outdated so we don't use them
const downExpected = {
  member: async (m: any, idx: number, db: DataSource) => {
    const expected = downValues.member[idx];
    expect(m.id).toEqual(expected.id);
    expect(m.name).toEqual(expected.name);
    expect(m.email).toEqual(expected.email);
    // extra changed type
    expect(m.extra).toEqual(expected.extra);
    expect(m.type).toEqual(expected.type ?? 'individual');
    expect(m.created_at).toBeTruthy();
    expect(m.updated_at).toBeTruthy();

    // password back in table
    if (m.password) {
      const password = downValues.member_password.find((d) => d.member_id === m.id)?.password;
      expect(m.password).toContain(password);
    }
  },
  item: async (item: any, idx: number) => {
    const expected = downValues.item[idx];
    expect(item.id).toEqual(expected.id);
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
    // does not exist anymore
    expect(item.deleted_at).toBeUndefined();
  },
  member_password: async (mp: any, idx: number, db) => {
    const expected = downValues.member_password[idx];
    const [m] = await db.query(`SELECT * FROM member WHERE id=\'${expected.member_id}\'`);
    expect(m.password).toContain(expected.password);
  },
  item_membership: async (im: any, idx: number) => {
    const expected = downValues.item_membership[idx];
    expect(im.id).toEqual(expected.id);
    expect(im.item_path).toEqual(expected.item_path);
    expect(im.creator).toEqual(expected.creator_id);
    expect(im.member_id).toEqual(expected.member_id);
    expect(im.created_at.toISOString()).toEqual(expected.created_at);
    expect(im.updated_at.toISOString()).toEqual(expected.created_at);
  },
  invitation: async (invitation: any, idx: number) => {
    const expected = downValues.invitation[idx];
    expect(invitation.id).toEqual(expected.id);
    expect(invitation.item_path).toEqual(expected.item_path);
    expect(invitation.creator).toEqual(expected.creator_id);
    expect(invitation.email).toEqual(expected.email);
    expect(invitation.name).toEqual(expected.name);
    expect(invitation.permission).toEqual(expected.permission);
    expect(invitation.created_at.toISOString()).toEqual(expected.created_at);
    expect(invitation.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  // TODO
  // action: async (action: any, idx: number) => {
  //   const expected = downValues.action[idx];
  //   expect(action.id).toEqual(expected.id);
  //   expect(action.item_id).toEqual(expected.item_path);
  //   expect(action.member_id).toEqual(expected.member_id);
  //   expect(action.geolocation).toEqual(expected.geolocation);
  //   expect(action.type).toEqual(expected.action_type);
  //   expect(action.extra).toEqual(expected.extra);
  //   expect(action.view).toEqual(expected.view);
  //   expect(action.created_at.toISOString()).toEqual(expected.created_at);
  // },
  // action_request_export: async (a: any, idx: number) => {
  //   const expected = downValues.action_request_export[idx];
  //   expect(a.id).toEqual(expected.id);
  //   expect(a.item_id).toEqual(expected.item_id);
  //   expect(a.member_id).toEqual(expected.member_id);
  //   expect(a.created_at.toISOString()).toEqual(expected.created_at);
  // },
  item_published: async (ip: any, idx: number, db: DataSource) => {
    // becomes tag
    const expected = downValues.item_published[idx];
    const [publishedTag] = await db.query('SELECT * FROM tag WHERE name= \'published-item\'');
    const [itemTag] = await db.query(
      `SELECT * FROM item_tag WHERE tag_id= '${publishedTag.id}' AND item_path='${expected.item_path}'`,
    );
    expect(itemTag.creator).toEqual(expected.creator_id);
  },
  recycled_item_data: async (recycledItem: any, idx: number, db: DataSource) => {
    const expected = downValues.recycled_item_data[idx];

    // table changed name
    const [newRecycledItem] = await db.query(
      `SELECT * FROM recycled_item WHERE id= '${expected.id}'`,
    );
    const item = await downValues.item.find(({ path }) => path === newRecycledItem.item_path);
    expect(newRecycledItem.id).toEqual(expected.id);
    expect(newRecycledItem.item_path).toEqual(item?.path);
    expect(newRecycledItem.item_id).toEqual(item?.id);
    expect(newRecycledItem.creator).toEqual(expected.creator_id);
    expect(newRecycledItem.created_at.toISOString()).toEqual(expected.created_at);
  },

  item_tag: async (itemTag: any, idx: number, db: DataSource) => {
    // table tag is back
    const expected = downValues.item_tag[idx];
    const [tag] = await db.query(`SELECT * FROM tag WHERE name= '${expected.type}'`);

    expect(itemTag.id).toEqual(expected.id);
    expect(itemTag.tag_id).toEqual(tag?.id);
    expect(itemTag.creator).toEqual(expected.creator_id);
    expect(itemTag.created_at.toISOString()).toEqual(expected.created_at);
  },
  category: async (c: any, idx: number, db: DataSource) => {
    // category type table is back
    const expected = downValues.category[idx];
    const [categoryType] = await db.query(
      `SELECT * FROM category_type WHERE name= '${expected.type}'`,
    );

    expect(c.id).toEqual(expected.id);
    expect(c.name).toEqual(expected.name);
    expect(c.type).toEqual(categoryType.id);
  },
  item_category: async (ic: any, idx: number) => {
    const expected = downValues.item_category[idx];
    const item = downValues.item.find(({ path }) => expected.item_path === path);
    expect(ic.id).toEqual(expected.id);
    expect(ic.category_id).toEqual(expected.category_id);
    expect(ic.item_id).toEqual(item?.id);
  },
  // item validation group becomes item validation
  item_validation_group: async (_iv: any, idx: number, db: DataSource) => {
    // item
    const expected = downValues.item_validation_group[idx];
    const [iv] = await db.query(`SELECT * FROM item_validation WHERE id= '${expected.id}'`);
    expect(iv.id).toEqual(expected.id);
    expect(iv.item_id).toEqual(expected.item_id);
    expect(iv.created_at.toISOString()).toEqual(expected.created_at);
  },
  item_validation_review: async (_ivr: any, _idx: number, db: DataSource) => {
    // empty db
    const rows = await db.query('SELECT * FROM item_validation_review');
    expect(rows).toHaveLength(0);
  },
  // item validation becomes item validation group
  item_validation: async (_ivg: any, idx: number, db: DataSource) => {
    const expected = downValues.item_validation[idx];
    const [ivg] = await db.query(`SELECT * FROM item_validation_group WHERE id= '${expected.id}'`);
    const [status] = await db.query(
      `SELECT * FROM item_validation_status WHERE name= '${expected.status}'`,
    );
    const [process] = await db.query(
      `SELECT * FROM item_validation_process WHERE name= '${expected.process}'`,
    );
    expect(ivg.id).toEqual(expected.id);
    expect(ivg.item_id).toEqual(expected.item_id);
    expect(ivg.item_validation_id).toEqual(expected.item_validation_group_id);
    expect(ivg.item_validation_process_id).toEqual(process.id);
    expect(ivg.status_id).toEqual(status.id);
    expect(ivg.result).toEqual(expected.result);
    expect(ivg.created_at.toISOString()).toEqual(expected.created_at);
    expect(ivg.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  item_login_schema: async (_iml: any, idx: number, db: DataSource) => {
    // item_login_schema -> schema in item
    const expected = downValues.item_login_schema[idx];
    const oldItem = downValues.item.find(({ path }) => path === expected.item_path);

    const [item] = await db.query(`SELECT * FROM item WHERE path= '${oldItem?.path}'`);
    if (item.extra?.itemLogin?.loginSchema) {
      expect(item.extra.itemLogin.loginSchema).toEqual(expected.type);
    }
  },
  item_login: async (_iml: any, idx: number, db: DataSource) => {
    // item_login -> item_member_login
    const expected = downValues.item_login[idx];
    const ils = await downValues.item_login_schema.find(
      ({ id }) => id === expected.item_login_schema_id,
    );
    const [item] = await db.query(`SELECT * FROM item WHERE path= '${ils?.item_path}'`);

    const [il] = await db.query(
      `SELECT * FROM item_member_login WHERE member_id= '${expected.member_id}' AND item_id= '${item.id}'`,
    );
    expect(il.item_id).toEqual(item.id);
    expect(il.member_id).toEqual(expected.member_id);
    expect(il.created_at.toISOString()).toEqual(expected.created_at);
  },
  chat_message: async (cm: any, idx: number) => {
    const expected = downValues.chat_message[idx];
    expect(cm.id).toEqual(expected.id);
    expect(cm.chat_id).toEqual(expected.item_id);
    expect(cm.creator).toEqual(expected.creator_id);
    expect(cm.body).toEqual(expected.body);
    expect(cm.created_at.toISOString()).toEqual(expected.created_at);
    expect(cm.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  chat_mention: async (cm: any, idx: number) => {
    const expected = downValues.chat_mention[idx];
    expect(cm.id).toEqual(expected.id);
    expect(cm.message_id).toEqual(expected.message_id);
    expect(cm.member_id).toEqual(expected.member_id);
    expect(cm.status).toEqual(expected.status ?? 'unread');
    expect(cm.created_at.toISOString()).toEqual(expected.created_at);
    expect(cm.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  item_flag: async (iflag: any, idx: number, db: DataSource) => {
    // flag comes back
    const expected = downValues.item_flag[idx];
    const [flag] = await db.query(`SELECT * FROM flag WHERE name= '${expected.type}'`);

    expect(iflag.id).toEqual(expected.id);
    expect(iflag.flag_id).toEqual(flag?.id);
    expect(iflag.item_id).toEqual(expected.item_id);
    expect(iflag.creator).toEqual(expected.creator_id);
    expect(iflag.created_at.toISOString()).toEqual(expected.created_at);
  },
  publisher: async (p: any, idx: number) => {
    const expected = downValues.publisher[idx];
    expect(p.id).toEqual(expected.id);
    expect(p.name).toEqual(expected.name);
    expect(p.origins).toEqual(expected.origins);
    expect(p.created_at.toISOString()).toEqual(expected.created_at);
  },
  app: async (a: any, idx: number) => {
    const expected = downValues.app[idx];
    expect(a.id).toEqual(expected.id);
    expect(a.name).toEqual(expected.name);
    expect(a.description).toEqual(expected.description);
    expect(a.url).toEqual(expected.url);
    expect(a.publisher_id).toEqual(expected.publisher_id);
    expect(a.extra).toEqual(expected.extra);
    expect(a.created_at.toISOString()).toEqual(expected.created_at);
  },
  app_data: async (ad: any, idx: number) => {
    const expected = downValues.app_data[idx];
    expect(ad.id).toEqual(expected.id);
    expect(ad.member_id).toEqual(expected.member_id);
    expect(ad.item_id).toEqual(expected.item_id);
    expect(ad.creator).toEqual(expected.creator_id);
    expect(ad.type).toEqual(expected.type);
    expect(ad.visibility).toEqual(expected.visibility);
    expect(ad.data).toEqual(expected.data);
    expect(ad.created_at.toISOString()).toEqual(expected.created_at);
  },
  app_action: async (aa: any, idx: number) => {
    const expected = downValues.app_action[idx];
    expect(aa.id).toEqual(expected.id);
    expect(aa.member_id).toEqual(expected.member_id);
    expect(aa.item_id).toEqual(expected.item_id);
    expect(aa.type).toEqual(expected.type);
    expect(aa.data).toEqual(expected.data);
    expect(aa.created_at.toISOString()).toEqual(expected.created_at);
  },
  app_setting: async (as: any, idx: number) => {
    const expected = downValues.app_setting[idx];
    expect(as.id).toEqual(expected.id);
    expect(as.creator).toEqual(expected.creator_id);
    expect(as.item_id).toEqual(expected.item_id);
    expect(as.name).toEqual(expected.name);
    expect(as.data).toEqual(expected.data);
    expect(as.created_at.toISOString()).toEqual(expected.created_at);
    expect(as.updated_at.toISOString()).toEqual(expected.updated_at);
  },
  item_like: async (il: any, idx: number) => {
    const expected = downValues.item_like[idx];
    expect(il.id).toEqual(expected.id);
    expect(il.member_id).toEqual(expected.creator_id);
    expect(il.item_id).toEqual(expected.item_id);
    expect(il.created_at.toISOString()).toEqual(expected.created_at);
  },
};

export const down = { values: downValues, expected: downExpected };
