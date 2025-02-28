import { pgEnum } from 'drizzle-orm/pg-core';

export const actionRequestExportFormatEnum = pgEnum('action_request_export_format_enum', [
  'json',
  'csv',
]);
export const chatMentionStatusEnum = pgEnum('chat_mention_status_enum', ['unread', 'read']);
export const shortLinkPlatformEnum = pgEnum('short_link_platform_enum', [
  'builder',
  'player',
  'library',
]);
export const tagCategoryEnum = pgEnum('tag_category_enum', [
  'level',
  'discipline',
  'resource-type',
]);
export const accountTypeEnum = pgEnum('account_type_enum', ['individual', 'guest']);
export const permissionEnum = pgEnum('permission_enum', ['read', 'write', 'admin']);
export const itemVisibilityEnum = pgEnum('item_visibility_type', ['public', 'hidden']);
