export const PLUGIN_NAME = 'graasp-plugin-etherpad';
export const ETHERPAD_API_VERSION = '1.2.13';

/**
 * User agents are now required to limit the sum of the lengths of the cookie's
 * name and value to 4096 bytes, and limit the length of each cookie attribute
 * value to 1024 bytes. Any attempt to set a cookie exceeding the name+value
 * limit is rejected, and any cookie attribute exceeding the attribute length
 * limit is ignored. See https://chromestatus.com/feature/4946713618939904
 */
export const MAX_COOKIE_VALUE_SIZE_BYTES = 1024;

/**
 * sessionID a string, the unique id of a session. Format is s.16RANDOMCHARS
 * for example s.s8oes9dhwrvt0zif (length is 18)
 * See https://etherpad.org/doc/v1.8.18/#index_data-types
 * We add a comma since the session IDs are joined (length + 1)
 * The session cookie can also contain multiple comma-separated sessionIDs
 * See https://etherpad.org/doc/v1.8.18/#index_session
 */
export const SESSION_VALUE_COOKIE_LENGTH = 19;

/**
 * Thus the maximum cookie size for etherpad sessions is
 * _MAX_COOKIE_VALUE_SIZE_BYTES / SESSION_VALUE_COOKIE_LENGTH_
 */
export const MAX_SESSIONS_IN_COOKIE = Math.floor(
  MAX_COOKIE_VALUE_SIZE_BYTES / SESSION_VALUE_COOKIE_LENGTH,
);
