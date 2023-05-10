import bcrypt from 'bcrypt';

import { ItemLoginSchemaType } from '@graasp/sdk';

import { randomHexOf4 } from '../utils';

const saltRounds = 10;

// TODO: reuse from password plugin?
export const encryptPassword = async (password: string): Promise<string> =>
  bcrypt.hash(password, saltRounds);

export const validatePassword = async (
  plainTextPassword: string,
  passwordHash: string,
): Promise<boolean> => bcrypt.compare(plainTextPassword, passwordHash);

export const loginSchemaRequiresPassword = (loginSchema: ItemLoginSchemaType): boolean =>
  loginSchema === ItemLoginSchemaType.UsernameAndPassword ||
  loginSchema === ItemLoginSchemaType.AnonymousAndPassword;

export const generateRandomEmail = (): string => `${randomHexOf4()}-${Date.now()}@graasp.org`;
