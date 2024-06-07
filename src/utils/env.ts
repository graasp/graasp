import { env } from 'process';

export const readEnv = (envName: string) => env[envName];

export const readEnvOrThrow = (envName: string): string => {
  const value = readEnv(envName);

  if (!value) {
    throw new Error(`The environment variable "${envName}" is not defined`);
  }

  return value;
};
