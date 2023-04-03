const memberId = '3e901df0-d246-4672-bb01-34269f4c0fed';
const itemId = '1e901df0-d246-4672-bb01-34269f4c0fed';
const itemPath = itemId.replace(/-/g, '_');

export const values = {
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
      password: 'mypassword1',
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
  item_membership: [
    {
      id: '0e901df0-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      member_id: memberId,
      permission: 'write',
      creator: memberId,
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
    },
  ],
  action: [
    {
      id: '0f901df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      member_id: memberId,
      item_type: 'folder',
      action_type: 'view',
      member_type: 'individual',
      view: 'builder',
      extra: { someData: 'invitation name' },
      geolocation: { some: 'geolocation' },
    },
  ],
  action_request_export: [
    {
      id: '0f901df1-d246-d671-bb01-34269f4c0fed',
      member_id: memberId,
      item_id: itemId,
    },
  ],
  recycled_item: [
    {
      id: '3f901df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      item_id: itemId,
      creator: memberId,
    },
  ],
  tag: [
    {
      id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      name: 'mytag',
      nested: 'allow',
    },
  ],
  item_tag: [
    {
      id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      tag_id: '3f911df1-d246-d672-bb01-34269f4c0fed',
      item_path: itemPath,
      creator: memberId,
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
  ],
  item_validation: [
    {
      id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      item_id: itemId,
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
      id: '0f901df0-d246-4672-bb01-34269f4c0fed',
      item_validation_id: 'e244bf4f-19e1-4674-b2a2-06bb5ac6e11c',
      reviewer_id: memberId,
      status_id: 'e244bf4f-19e0-4674-b2a2-06bb5ac6e11c',
      reason: 'myreason',
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
    },
  ],
  item_member_login: [
    {
      id: 'ae901df0-d246-4673-bb01-34269f4c0fed',
      item_id: itemId,
      member_id: memberId,
    },
  ],
  chat_message: [
    {
      id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      chat_id: itemId,
      creator: memberId,
      body: 'mymessage',
    },
  ],
  chat_mention: [
    {
      id: 'e244bf4f-39e1-4672-b2a2-06bb5ac6e11c',
      item_path: itemPath,
      message_id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      member_id: memberId,
      creator: memberId,
      status: 'read',
    },
    // default status value
    {
      id: 'e244bf4f-39e1-4672-b2a2-06bb3ac6e11c',
      item_path: itemPath,
      message_id: 'e244bf4f-39e1-4674-b2a2-06bb5ac6e11c',
      member_id: memberId,
      creator: memberId,
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
    },
  ],
  publisher: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e11c',
      name: 'mypublisher',
      origins: ['someorigin'],
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
    },
  ],
  app_action: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
      data: { some: 'data' },
      type: 'some type',
    },
  ],
  app_setting: [
    {
      id: 'e245bf4f-32e2-4672-b2a2-06bb3ac6e12c',
      creator: memberId,
      item_id: itemId,
      data: { some: 'data' },
      name: 'some type',
    },
  ],
  item_like: [
    {
      id: 'e245af4f-32e2-4672-b2a2-06bb3ac6e12c',
      member_id: memberId,
      item_id: itemId,
    },
  ],
};

// types will be outdated so we don't use them
export const expected = {
  member: async (m: any, idx: number) => {
    const expected = values.member[idx];
    expect(m.id).toEqual(expected.id);
    expect(m.name).toEqual(expected.name);
    expect(m.email).toEqual(expected.email);
    expect(m.extra).toEqual(expected.extra);
    // password has a set length
    expect(m.password).toContain(expected.password);
    expect(m.type).toEqual(expected.type ?? 'individual');
    expect(m.created_at).toBeTruthy();
    expect(m.updated_at).toBeTruthy();
  },
  item: async (item: any, idx: number) => {
    const expected = values.item[idx];
    expect(item.id).toEqual(itemId);
    expect(item.name).toEqual(expected.name);
    expect(item.creator).toEqual(expected.creator);
    expect(item.description).toEqual(expected.description);
    expect(item.extra).toEqual(expected.extra);
    expect(item.settings).toEqual(expected.settings);
    expect(item.path).toEqual(expected.path);
    expect(item.created_at).toBeTruthy();
    expect(item.updated_at).toBeTruthy();
  },
  item_membership: async (im: any, idx: number) => {
    const expected = values.item_membership[idx];

    expect(im.id).toEqual(expected.id);
    expect(im.item_path).toEqual(expected.item_path);
    expect(im.creator).toEqual(expected.creator);
    expect(im.member_id).toEqual(expected.member_id);
    expect(im.created_at).toBeTruthy();
    expect(im.updated_at).toBeTruthy();
  },
  invitation: async (invitation: any, idx: number) => {
    const expected = values.invitation[idx];

    expect(invitation.id).toEqual(expected.id);
    expect(invitation.item_path).toEqual(expected.item_path);
    expect(invitation.creator).toEqual(expected.creator);
    expect(invitation.email).toEqual(expected.email);
    expect(invitation.name).toEqual(expected.name);
    expect(invitation.permission).toEqual(expected.permission);
    expect(invitation.created_at).toBeTruthy();
    expect(invitation.updated_at).toBeTruthy();
  },
  action: async (action: any, idx: number) => {
    const expected = values.action[idx];
    expect(action.id).toEqual(expected.id);
    expect(action.item_path).toEqual(expected.item_path);
    expect(action.member_id).toEqual(expected.member_id);
    expect(action.item_type).toEqual(expected.item_type);
    expect(action.member_type).toEqual(expected.member_type);
    expect(action.geolocation).toEqual(expected.geolocation);
    expect(action.action_type).toEqual(expected.action_type);
    expect(action.extra).toEqual(expected.extra);
    expect(action.view).toEqual(expected.view);
    expect(action.created_at).toBeTruthy();
  },
  action_request_export: async (a: any, idx: number) => {
    const expected = values.action_request_export[idx];
    expect(a.id).toEqual(expected.id);
    expect(a.item_id).toEqual(expected.item_id);
    expect(a.member_id).toEqual(expected.member_id);
    expect(a.created_at).toBeTruthy();
  },
  recycled_item: async (recycledItem: any, idx: number) => {
    const expected = values.recycled_item[idx];
    expect(recycledItem.id).toEqual(expected.id);
    expect(recycledItem.item_id).toEqual(expected.item_id);
    expect(recycledItem.creator).toEqual(expected.creator);
    expect(recycledItem.item_path).toEqual(expected.item_path);
    expect(recycledItem.created_at).toBeTruthy();
  },
  tag: async (tag: any, idx: number) => {
    const expected = values.tag[idx];
    expect(tag.id).toEqual(expected.id);
    expect(tag.name).toEqual(expected.name);
    expect(tag.nested).toEqual(expected.nested);
    expect(tag.created_at).toBeTruthy();
  },
  item_tag: async (itemTag: any, idx: number) => {
    const expected = values.item_tag[idx];
    expect(itemTag.id).toEqual(expected.id);
    expect(itemTag.tag_id).toEqual(expected.tag_id);
    expect(itemTag.creator).toEqual(expected.creator);
    expect(itemTag.created_at).toBeTruthy();
  },
  category_type: async (ct: any, idx: number) => {
    const expected = values.category_type[idx];
    expect(ct.id).toEqual(expected.id);
    expect(ct.name).toEqual(expected.name);
  },
  category: async (c: any, idx: number) => {
    const expected = values.category[idx];
    expect(c.id).toEqual(expected.id);
    expect(c.name).toEqual(expected.name);
    expect(c.type).toEqual(expected.type);
  },
  item_category: async (ic: any, idx: number) => {
    const expected = values.item_category[idx];
    expect(ic.id).toEqual(expected.id);
    expect(ic.category_id).toEqual(expected.category_id);
    expect(ic.item_id).toEqual(expected.item_id);
  },
  item_validation_process: async (ivp: any, idx: number) => {
    const expected = values.item_validation_process[idx];
    expect(ivp.id).toEqual(expected.id);
    expect(ivp.name).toEqual(expected.name);
    expect(ivp.description).toEqual(expected.description);
    expect(ivp.enabled).toEqual(expected.enabled);
  },
  item_validation_status: async (ivs: any, idx: number) => {
    const expected = values.item_validation_status[idx];
    expect(ivs.id).toEqual(expected.id);
    expect(ivs.name).toEqual(expected.name);
  },
  item_validation: async (iv: any, idx: number) => {
    const expected = values.item_validation[idx];
    expect(iv.id).toEqual(expected.id);
    expect(iv.item_id).toEqual(expected.item_id);
    expect(iv.created_at).toBeTruthy();
  },
  item_validation_review_status: async (ivrs: any, idx: number) => {
    const expected = values.item_validation_review_status[idx];
    expect(ivrs.id).toEqual(expected.id);
    expect(ivrs.name).toEqual(expected.name);
  },
  item_validation_review: async (ivr: any, idx: number) => {
    const expected = values.item_validation_review[idx];
    expect(ivr.id).toBeTruthy();
    expect(ivr.item_validation_id).toEqual(expected.item_validation_id);
    expect(ivr.reviewer_id).toEqual(expected.reviewer_id);
    expect(ivr.status_id).toEqual(expected.status_id);
    expect(ivr.reason).toEqual(expected.reason);
    expect(ivr.created_at).toBeTruthy();
    expect(ivr.updated_at).toBeTruthy();
  },
  item_validation_group: async (ivg: any, idx: number) => {
    const expected = values.item_validation_group[idx];
    expect(ivg.id).toBeTruthy();
    expect(ivg.item_id).toEqual(expected.item_id);
    expect(ivg.item_validation_id).toEqual(expected.item_validation_id);
    expect(ivg.item_validation_process_id).toEqual(expected.item_validation_process_id);
    expect(ivg.status_id).toEqual(expected.status_id);
    expect(ivg.result).toEqual(expected.result);
    expect(ivg.created_at).toBeTruthy();
    expect(ivg.updated_at).toBeTruthy();
  },
  item_member_login: async (iml: any, idx: number) => {
    const expected = values.item_member_login[idx];
    expect(iml.item_id).toEqual(expected.item_id);
    expect(iml.member_id).toEqual(expected.member_id);
    expect(iml.created_at).toBeTruthy();
  },
  chat_message: async (cm: any, idx: number) => {
    const expected = values.chat_message[idx];
    expect(cm.id).toEqual(expected.id);
    expect(cm.chat_id).toEqual(expected.chat_id);
    expect(cm.creator).toEqual(expected.creator);
    expect(cm.body).toEqual(expected.body);
    expect(cm.created_at).toBeTruthy();
    expect(cm.updated_at).toBeTruthy();
  },
  chat_mention: async (cm: any, idx: number) => {
    const expected = values.chat_mention[idx];
    expect(cm.id).toEqual(expected.id);
    expect(cm.item_path).toEqual(expected.item_path);
    expect(cm.creator).toEqual(expected.creator);
    expect(cm.message_id).toEqual(expected.message_id);
    expect(cm.member_id).toEqual(expected.member_id);
    expect(cm.status).toEqual(expected.status ?? 'unread');
    expect(cm.created_at).toBeTruthy();
    expect(cm.updated_at).toBeTruthy();
  },
  flag: async (flag: any, idx: number) => {
    const expected = values.flag[idx];
    expect(flag.id).toEqual(expected.id);
    expect(flag.name).toEqual(expected.name);
  },
  item_flag: async (iflag: any, idx: number) => {
    const expected = values.item_flag[idx];
    expect(iflag.id).toEqual(expected.id);
    expect(iflag.flag_id).toEqual(expected.flag_id);
    expect(iflag.item_id).toEqual(expected.item_id);
    expect(iflag.creator).toEqual(expected.creator);
    expect(iflag.created_at).toBeTruthy();
  },
  publisher: async (p: any, idx: number) => {
    const expected = values.publisher[idx];
    expect(p.id).toEqual(expected.id);
    expect(p.name).toEqual(expected.name);
    expect(p.origins).toEqual(expected.origins);
    expect(p.created_at).toBeTruthy();
  },
  app: async (a: any, idx: number) => {
    const expected = values.app[idx];
    expect(a.id).toEqual(expected.id);
    expect(a.name).toEqual(expected.name);
    expect(a.description).toEqual(expected.description);
    expect(a.url).toEqual(expected.url);
    expect(a.publisher_id).toEqual(expected.publisher_id);
    expect(a.extra).toEqual(expected.extra);
    expect(a.created_at).toBeTruthy();
  },
  app_data: async (ad: any, idx: number) => {
    const expected = values.app_data[idx];
    expect(ad.id).toEqual(expected.id);
    expect(ad.member_id).toEqual(expected.member_id);
    expect(ad.item_id).toEqual(expected.item_id);
    expect(ad.creator).toEqual(expected.creator);
    expect(ad.type).toEqual(expected.type);
    expect(ad.visibility).toEqual(expected.visibility);
    expect(ad.data).toEqual(expected.data);
    expect(ad.created_at).toBeTruthy();
  },
  app_action: async (aa: any, idx: number) => {
    const expected = values.app_action[idx];
    expect(aa.id).toEqual(expected.id);
    expect(aa.member_id).toEqual(expected.member_id);
    expect(aa.item_id).toEqual(expected.item_id);
    expect(aa.type).toEqual(expected.type);
    expect(aa.data).toEqual(expected.data);
    expect(aa.created_at).toBeTruthy();
  },
  app_setting: async (as: any, idx: number) => {
    const expected = values.app_setting[idx];
    expect(as.id).toEqual(expected.id);
    expect(as.creator).toEqual(expected.creator);
    expect(as.item_id).toEqual(expected.item_id);
    expect(as.name).toEqual(expected.name);
    expect(as.data).toEqual(expected.data);
    expect(as.created_at).toBeTruthy();
    expect(as.updated_at).toBeTruthy();
  },
  item_like: async (il: any, idx: number) => {
    const expected = values.item_like[idx];
    expect(il.id).toEqual(expected.id);
    expect(il.member_id).toEqual(expected.member_id);
    expect(il.item_id).toEqual(expected.item_id);
    expect(il.created_at).toBeTruthy();
  },
};
