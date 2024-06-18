import { AUTH_CLIENT_HOST, PLAYER_HOST } from '../../../../utils/config.js';
import { Invitation } from './entity.js';

export const PLUGIN_NAME = 'graasp-plugin-invitations';

export const buildInvitationLink = (invitation: Invitation) => {
  const url = new URL('signup', AUTH_CLIENT_HOST);
  url.searchParams.set('invitationId', invitation.id);
  const destination = new URL(invitation.item.id, PLAYER_HOST.url);
  url.searchParams.set('url', encodeURIComponent(destination.toString()));
  return url.toString();
};

// to-do define the constant multipart
// refactor to the constants
export const MAX_FILE_SIZE = 1024 * 1024 * 200; // 200 MB
export const CSV_MIMETYPE = 'text/csv';
export const GROUP_COL_NAME = 'group_name';
export const EMAIL_COLUMN_NAME = 'email';
