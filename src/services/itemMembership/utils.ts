export const getPermissionsAtItemSql = (
  itemPath: string,
  newParentItemPath: string,
  itemIdAsPath: string,
  parentItemPath?: string,
) => {
  const ownItemPermissions = `
    SELECT
      member_id,
      '${newParentItemPath}' || subpath(item_path, index(item_path, '${itemIdAsPath}')) AS item_path,
      permission,
      2 AS action -- 2: belonging to tree (possible DELETE after moving items because of inherited at destination and the "ON UPDATE CASCADE")
    FROM item_membership
    WHERE '${itemPath}' @> item_path
  `;

  if (!parentItemPath) return ownItemPermissions;

  return `
    SELECT member_id, item_path, max(permission) AS permission, max(action) AS action FROM (
      -- "last" inherited permission, for each member, at the origin of the moving item
      SELECT
        member_id,
        '${newParentItemPath}'::ltree || '${itemIdAsPath}' AS item_path,
        max(permission) AS permission,
        1 AS action -- 1: inherited at origin (possible INSERT 'at' new item's path)
      FROM item_membership
      WHERE item_path @> '${parentItemPath}'
      GROUP BY member_id

      UNION ALL

      -- "own" permissions
      ${ownItemPermissions}
    ) AS t1
    GROUP BY member_id, item_path
  `;
};
