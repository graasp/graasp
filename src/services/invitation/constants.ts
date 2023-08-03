import { AUTH_CLIENT_HOST } from '../../utils/config';
import { Invitation } from './invitation';

export const PLUGIN_NAME = 'graasp-plugin-invitations';

export const buildInvitationLink = (invitation: Invitation) => {
  const url = new URL('signup', AUTH_CLIENT_HOST);
  url.searchParams.set('invitationId', invitation.id);
  return url.toString();
};
