import bcrypt from 'bcrypt';

import { FastifyBaseLogger } from 'fastify';

import { SALT_ROUNDS } from '../../../../utils/config';
import { MemberPassword } from './entities/password';
import { PasswordNotDefined } from './errors';

/** @deprecated */
export const verifyCredentials = (
  memberPassword: MemberPassword,
  body: { email: string; password: string },
  log?: FastifyBaseLogger,
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
    .catch((err) => log?.error(err.message));
  return verified;
};

/** @deprecated */
export async function verifyCurrentPassword(
  memberPassword?: MemberPassword | null,
  password?: string,
) {
  /* verified: stores the output of bcrypt.compare().
  bcrypt.compare() allows to compare the provided password with a stored hash. 
  It deduces the salt from the hash and is able to then hash the provided password correctly for comparison
  if they match, verified is true 
  if they do not match, verified is false
  */
  // if the member already has a password set: return verified
  if (memberPassword?.password) {
    if (!password) {
      throw new PasswordNotDefined();
    }
    const verified = bcrypt
      .compare(password, memberPassword.password)
      .then((res) => res)
      .catch((err) => console.error(err.message));
    return verified;
  }
  // if the member does not have a password set: return true
  return true;
}

/**
 * Compares a plain password with a hash.
 * @param password Password to encrypt.
 * @param hash Hash to be compared against.
 * @returns A promise to be either resolved with the comparison result salt or rejected with an Error
 */
export async function comparePasswords(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function encryptPassword(password: string) {
  /* encrypted: stores the output of bcrypt.hash().
  bcrypt.hash() creates the salt and hashes the password. 
  A new hash is created each time the function is run, regardless of the password being the same. 
  */
  const encrypted = bcrypt
    .hash(password, SALT_ROUNDS)
    .then((hash) => hash)
    .catch((err) => {
      console.error(err.message);
      throw err;
    });
  return encrypted;
}
