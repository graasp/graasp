import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { StatusCodes } from 'http-status-codes';
import jwt, { Secret, SignOptions, TokenExpiredError, VerifyOptions } from 'jsonwebtoken';
import { JsonWebTokenError } from 'jsonwebtoken';
import { promisify } from 'util';

import fastifyAuth from '@fastify/auth';
import fastifyBearerAuth from '@fastify/bearer-auth';
import fastifyCors from '@fastify/cors';
import fastifySecureSession from '@fastify/secure-session';
import { FastifyBaseLogger, FastifyPluginAsync, FastifyRequest } from 'fastify';

import { Member } from '../../services/members/member';
import { TaskManager as MemberTaskManager } from '../../services/members/task-manager';
import {
  AUTH_CLIENT_HOST,
  AUTH_TOKEN_EXPIRATION_IN_MINUTES,
  AUTH_TOKEN_JWT_SECRET,
  CLIENT_HOST,
  DEFAULT_LANG,
  EMAIL_LINKS_HOST,
  GRAASP_ACTOR,
  JWT_SECRET,
  LOGIN_TOKEN_EXPIRATION_IN_MINUTES,
  PROD,
  PROTOCOL,
  REDIRECT_URL,
  REFRESH_TOKEN_EXPIRATION_IN_MINUTES,
  REFRESH_TOKEN_JWT_SECRET,
  REGISTER_TOKEN_EXPIRATION_IN_MINUTES,
  SECURE_SESSION_SECRET_KEY,
  STAGING,
  TOKEN_BASED_AUTH,
} from '../../util/config';
import {
  EmptyCurrentPassword,
  IncorrectPassword,
  InvalidPassword,
  InvalidSession,
  InvalidToken,
  MemberAlreadySignedUp,
  MemberNotSignedUp,
  MemberWithoutPassword,
  OrphanSession,
  TokenExpired,
} from '../../util/graasp-error';
import { SALT_ROUNDS } from './constants';
import { MemberPassword } from './entities/password';
import {
  auth,
  login,
  mPasswordLogin,
  mauth,
  mdeepLink,
  mlogin,
  mregister,
  passwordLogin,
  register,
  updatePassword,
} from './schemas';

const promisifiedJwtSign = promisify<
  { sub: string; challenge?: string },
  Secret,
  SignOptions,
  string
>(jwt.sign);

export const verifyCredentials = (
  memberPassword: MemberPassword,
  body: { email: string; password: string },
  log: FastifyBaseLogger,
) => {
  /* the verified variable is used to store the output of bcrypt.compare() 
  bcrypt.compare() allows to compare the provided password with a stored hash. 
  It deduces the salt from the hash and is able to then hash the provided password correctly for comparison
  if they match, verified is true 
  if they do not match, verified is false
  */
  const verified = bcrypt
    .compare(body.password, memberPassword.password)
    .then((res) => res)
    .catch((err) => log.error(err.message));
  return verified;
};

async function verifyCurrentPassword(memberPassword: MemberPassword, password: string) {
  /* verified: stores the output of bcrypt.compare().
  bcrypt.compare() allows to compare the provided password with a stored hash. 
  It deduces the salt from the hash and is able to then hash the provided password correctly for comparison
  if they match, verified is true 
  if they do not match, verified is false
  */
  // if the member already has a password set: return verified
  if (memberPassword.password) {
    const verified = bcrypt
      .compare(password, memberPassword.password)
      .then((res) => res)
      .catch((err) => console.error(err.message));
    return verified;
  }
  // if the member does not have a password set: return true
  return true;
}

async function encryptPassword(password: string) {
  /* encrypted: stores the output of bcrypt.hash().
  bcrypt.hash() creates the salt and hashes the password. 
  A new hash is created each time the function is run, regardless of the password being the same. 
  */
  const encrypted = bcrypt
    .hash(password, SALT_ROUNDS)
    .then((hash) => hash)
    .catch((err) => console.error(err.message));
  return encrypted;
}

const plugin: FastifyPluginAsync = async (fastify) => {
  const { log, db } = fastify;

  const memberRepository = db.getRepository(Member);
  const memberPasswordRepository = db.getRepository(MemberPassword);

  // login with password
  fastify.post<{ Body: { email: string; password: string } }>(
    '/login-password',
    { schema: passwordLogin },
    async ({ body, log }, reply) => {
      const email = body.email.toLowerCase();
      const member = await memberRepository.findOneBy({ email: body.email });

      if (!member) {
        const { email } = body;
        log.warn(`Login attempt with non-existent email '${email}'`);
        throw new MemberNotSignedUp({ email });
      }

      const memberPassword = await memberPasswordRepository.findOneBy({  member:{id:member.id} });

      if (!memberPassword) {
        log.warn('Login attempt with non-existent password');
        throw new MemberWithoutPassword({ email });
      }
      const verified = await verifyCredentials(memberPassword, body, log);
      if (!verified) {
        throw new IncorrectPassword(body);
      }

      const token = await promisifiedJwtSign({ sub: member.id }, JWT_SECRET, {
        expiresIn: `${LOGIN_TOKEN_EXPIRATION_IN_MINUTES}m`,
      });
      // link for graasp web
      const linkPath = '/auth';
      const resource = `${PROTOCOL}://${EMAIL_LINKS_HOST}${linkPath}?t=${token}`;
      reply.status(StatusCodes.SEE_OTHER).send({ resource });
    },
  );

  // update member password
  fastify.patch(
    '/members/update-password',
    { schema: updatePassword, preHandler: fastify.verifyAuthentication },
    async ({ member, body }) => {
      const memberPassword = await memberPasswordRepository.findOneBy({ id: member.id });

      // verify that input current password is the same as the stored one
      const verified = await verifyCurrentPassword(memberPassword, body['currentPassword']);
      // throw error if password verification fails
      if (!verified) {
        if (body['currentPassword'] === '') {
          throw new EmptyCurrentPassword();
        }
        throw new InvalidPassword();
      }
      // auto-generate a salt and a hash
      const hash = await encryptPassword(body['password']);
      await memberPasswordRepository.update(member.id,{
        password: hash,
      });
    },
  );
};

export default plugin;
