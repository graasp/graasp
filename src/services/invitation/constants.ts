import { AUTH_CLIENT_HOST, PLAYER_HOST } from '../../utils/config';
import { Invitation } from './invitation';

export const PLUGIN_NAME = 'graasp-plugin-invitations';

export const buildInvitationLink = (invitation: Invitation) => {
  const url = new URL('signup', AUTH_CLIENT_HOST);
  url.searchParams.set('invitationId', invitation.id);
  const destination = new URL(`/item/${invitation.item.id}`, PLAYER_HOST.url);
  url.searchParams.set('url', encodeURIComponent(destination.toString()));
  return url.toString();
};
