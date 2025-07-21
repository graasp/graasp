import { getEnv } from './env';

getEnv();

export const PROTOCOL = process.env.PROTOCOL || 'http';
export const HOSTNAME = process.env.HOSTNAME || 'localhost';
/**
 * Host address the server listen on, default to 0.0.0.0 to bind to all addresses.
 */
export const HOST_LISTEN_ADDRESS = process.env.HOST_LISTEN_ADDRESS || '0.0.0.0';

export const PORT = process.env.PORT ? +process.env.PORT : 3000;
export const HOST = `${PROTOCOL}://${HOSTNAME}:${PORT}`; /**
 * Public url is the url where the server is hosted. Mostly used to set the cookie on the right domain
 * Warning for PUBLIC_URL:
 * make sure that process.env.PUBLIC_URL / HOST have the format ${PROTOCOL}://${HOSTNAME}:${PORT}
 * See the following example where the format is only ${HOSTNAME}:${PORT} in which case
 * it interprets the hostname as protocol and the port as the pathname. Using the complete URL
 * scheme fixes that
 *
 * $ node
 * Welcome to Node.js v16.20.1.
 * Type ".help" for more information.
 * > new URL('localhost:3000')
 * URL {
 *   href: 'localhost:3000',
 *   origin: 'null',
 *   protocol: 'localhost:',
 *   username: '',
 *   password: '',
 *   host: '',
 *   hostname: '',
 *   port: '',
 *   pathname: '3000',
 *   search: '',
 *   searchParams: URLSearchParams {},
 *   hash: ''
 * }
 * >
 */
export const PUBLIC_URL = new URL(process.env.PUBLIC_URL ?? HOST);
