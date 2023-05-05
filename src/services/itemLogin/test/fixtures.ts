import { ItemLoginSchemaType } from '@graasp/sdk';
import { v4 } from 'uuid';


export const MOCK_LOGIN_SCHEMA = ItemLoginSchemaType.USERNAME;

export const USERNAME_LOGIN = {
  username: 'my-username',
};

export const MEMBER_ID_LOGIN = {
  memberId: v4(),
};
