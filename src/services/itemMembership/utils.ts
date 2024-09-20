export enum PermissionType {
  InheritedAtDestination,
  InheritedAtOrigin,
  BellongsToTree,
}

export const getPermissionsAtItemSql = (
  itemPath: string,
  newParentItemPath: string,
  itemIdAsPath: string,
  parentItemPath?: string,
) => {
  const ownItemPermissions = `
    SELECT
      account_id,
      '${newParentItemPath}' || subpath(item_path, index(item_path, '${itemIdAsPath}')) AS item_path,
      permission,
      ${PermissionType.BellongsToTree} AS action -- 2: belonging to tree (possible DELETE after moving items because of inherited at destination and the "ON UPDATE CASCADE")
    FROM item_membership
    WHERE '${itemPath}' @> item_path
  `;

  if (!parentItemPath) {
    return ownItemPermissions;
  }

  return `
    SELECT account_id, item_path, max(permission) AS permission, max(action) AS action FROM (
      -- "last" inherited permission, for each account, at the origin of the moving item
      SELECT
        account_id,
        '${newParentItemPath}'::ltree || '${itemIdAsPath}' AS item_path,
        max(permission) AS permission,
        ${PermissionType.InheritedAtOrigin} AS action -- 1: inherited at origin (possible INSERT 'at' new item's path)
      FROM item_membership
      WHERE item_path @> '${parentItemPath}'
      GROUP BY account_id

      UNION ALL

      -- "own" permissions
      ${ownItemPermissions}
    ) AS t1
    GROUP BY account_id, item_path
  `;
};
