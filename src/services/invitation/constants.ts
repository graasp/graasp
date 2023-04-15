import { AUTH_CLIENT_HOST, PROTOCOL } from '../../utils/config';

export const PLUGIN_NAME = 'graasp-plugin-invitations';

export const buildInvitationLink = (invitation) =>
`${PROTOCOL}://${AUTH_CLIENT_HOST}/signup?invitationId=${invitation.id}`;
