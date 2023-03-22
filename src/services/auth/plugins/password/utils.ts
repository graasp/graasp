import bcrypt from 'bcrypt';

import { FastifyLoggerInstance } from 'fastify';

import { SALT_ROUNDS } from '../../../../util/config';
import { MemberPassword } from './entities/password';

export const verifyCredentials = (
  memberPassword: MemberPassword,
  body: { email: string; password: string },
  log: FastifyLoggerInstance,
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

export async function verifyCurrentPassword(memberPassword: MemberPassword, password: string) {
  /* verified: stores the output of bcrypt.compare().
  bcrypt.compare() allows to compare the provided password with a stored hash. 
  It deduces the salt from the hash and is able to then hash the provided password correctly for comparison
  if they match, verified is true 
  if they do not match, verified is false
  */
  // if the member already has a password set: return verified
  if (memberPassword?.password) {
    const verified = bcrypt
      .compare(password, memberPassword.password)
      .then((res) => res)
      .catch((err) => console.error(err.message));
    return verified;
  }
  // if the member does not have a password set: return true
  return true;
}

export async function encryptPassword(password: string) {
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
