import { ClientManager, Context } from '@graasp/sdk';

import { Invitation } from './entity';

export const PLUGIN_NAME = 'graasp-plugin-invitations';

/**
 * Build redirection url to player, where the user is redirected to once the user has signed up
 * @param invitation
 * @returns
 */
export const buildInvitationLink = (invitation: Invitation) => {
  const destination = ClientManager.getInstance().getItemLink(Context.Player, invitation.item.id);
  const url = ClientManager.getInstance().getURLByContext(Context.Auth, 'register', {
    invitationId: invitation.id,
    url: destination.toString(),
  });
  return url.toString();
};

// to-do define the constant multipart
// refactor to the constants
export const MAX_FILE_SIZE = 1024 * 1024 * 200; // 200 MB
export const CSV_MIMETYPE = 'text/csv';
export const GROUP_COL_NAME = 'group_name';
export const EMAIL_COLUMN_NAME = 'email';
