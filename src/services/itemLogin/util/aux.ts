import bcrypt from 'bcrypt';
import crypto from 'crypto';

import { ItemLoginSchemaType } from '@graasp/sdk';

const randomHexOf4 = () => crypto.randomBytes(2).toString('hex');
const saltRounds = 10;

export const encryptPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, saltRounds);

export const validatePassword = async (
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> => bcrypt.compare(plainTextPassword, passwordHash);

export const loginSchemaRequiresPassword = (loginSchema: ItemLoginSchemaType): boolean =>
  loginSchema === ItemLoginSchemaType.USERNAME_AND_PASSWORD ||
  loginSchema === ItemLoginSchemaType.AnonymousAndPassword;

export const generateRandomEmail = (): string => `${randomHexOf4()}-${Date.now()}@graasp.org`;
