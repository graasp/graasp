export type ItemMemberLogin = {
  itemId: string;
  memberId: string;
  createdAt: string;
};

// Members
export type ItemLoginMemberCredentials = {
  memberId?: string;
  username?: string;
  password?: string;
};
