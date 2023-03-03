export interface ItemMemberLogin {
  itemId: string;
  memberId: string;
  createdAt: string;
}

// Members
export interface ItemLoginMemberCredentials {
  memberId?: string;
  username?: string;
  password?: string;
}
