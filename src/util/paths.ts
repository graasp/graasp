// todo: refactor in graasp sdk, path builder
export const paths = {
  baseItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,
  // todo: to merge for one regex
  createItem: /^\/items$/,
  createItemWithParent: /^\/items\/?parentId=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,

  deleteItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,
  deleteItems: /^\/items\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,

  copyItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)\/copy/,
  copyItems: /^\/items\/copy\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,
  moveItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)\/move/,
  moveItems: /^\/items\/move\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,
  childrenItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)\/children/,
  multipleItems: /^\/items\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,

  createItemMembership: /^\/item-memberships\?itemId=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,
  baseItemMembership: /^\/item-memberships\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,

  baseMember: /^\/members\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,

  authRegister: /^\/register\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,
  authSignIn: /^\/login\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,
  authSignOut: /^\/logout$/,
  authSignInPassword: /^\/login-password$/,
  authUpdatePassword: /^\/members\/update-password$/,
};
