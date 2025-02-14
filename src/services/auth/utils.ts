import { sign } from 'jsonwebtoken';

import { FastifyBaseLogger } from 'fastify';

import { ClientManager, Context } from '@graasp/sdk';

import {
  ALLOWED_ORIGINS,
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
} from '../../utils/config';

const defaultClientHost = ClientManager.getInstance().getLinkByContext(Context.Home);

export const getRedirectionLink = (log: FastifyBaseLogger, target?: string) => {
  if (!target) {
    return defaultClientHost;
  }

  try {
    const targetUrl = new URL(target);
    if (!ALLOWED_ORIGINS.includes(targetUrl.origin)) {
      log.error(
        `redirection-url-util: Attempted to use a non valid origin  (url: ${targetUrl.toString()})`,
      );
      return defaultClientHost;
    }
  } catch {
    return defaultClientHost;
  }

  return target;
};

export function generateAuthTokensPair(memberId: string): {
  authToken: string;
  refreshToken: string;
} {
  const [authToken, refreshToken] = [
    sign({ sub: memberId }, AUTH_TOKEN_JWT_SECRET, {
      expiresIn: AUTH_TOKEN_EXPIRATION_IN_MINUTES * 60,
    }),
    sign({ sub: memberId }, REFRESH_TOKEN_JWT_SECRET, {
      expiresIn: REFRESH_TOKEN_EXPIRATION_IN_MINUTES * 60,
    }),
  ];
  return { authToken, refreshToken };
}
