import jwt, { Secret, SignOptions, TokenExpiredError, VerifyOptions } from 'jsonwebtoken';
import { promisify } from 'util';

import { JWT_SECRET, LOGIN_TOKEN_EXPIRATION_IN_MINUTES } from '../../utils/config';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

export const generateToken = (data, expiration) =>
  promisifiedJwtSign(data, JWT_SECRET, {
    expiresIn: expiration,
  });
