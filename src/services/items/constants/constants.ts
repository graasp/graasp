export const VIEW_UNKNOWN_NAME = 'unknown';

export enum METHODS {
  GET = 'GET',
  POST = 'POST',
  PATCH = 'PATCH',
}

export enum ACTION_TYPES {
  GET = 'get',
  GET_CHILDREN = 'get_children',
  UPDATE = 'update',
  CREATE = 'create',
  DELETE = 'delete',
  COPY = 'copy',
  MOVE = 'move',
}

// todo: refactor from graasp utils? constants?
export const paths = {
  baseItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)$/,
  copyItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)\/copy/,
  copyItems: /^\/items\/copy\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,
  moveItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)\/move/,
  moveItems: /^\/items\/move\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,
  childrenItem: /^\/items\/(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)\/children/,
  multipleItems: /^\/items\?id=(?=.*[0-9])(?=.*[a-zA-Z])([a-z0-9-]+)/,
};

// todo: import types from global constants repo
export const ITEM_TYPES = {
  FOLDER: 'folder',
};
