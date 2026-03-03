import { config } from 'dotenv';

const Environment = {
  production: 'production',
  staging: 'staging',
  development: 'development',
  test: 'test',
} as const;

export const NODE_ENV = process.env.NODE_ENV ?? Environment.development;

const once = (fn) => {
  let called = false;
  return function (...args) {
    if (called) return;
    called = true;
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    return fn.apply(this, args);
  };
};

/**
 * Pull env vars from file depending on `NODE_ENV` variable
 */
export const getEnv = once(() => {
  switch (NODE_ENV) {
    case Environment.production:
      config({ path: '.env.production', override: true });
      return Environment.production;
    case Environment.staging:
      config({ path: '.env.staging', override: true });
      return Environment.staging;
    case Environment.test:
      config({ path: '.env.test', override: true });
      return Environment.test;
    default:
      config({ path: '.env.development', override: true });
      return Environment.development;
  }
});

export const PROD = NODE_ENV === Environment.production;
export const STAGING = NODE_ENV === Environment.staging;
export const DEV = NODE_ENV === Environment.development;
export const TEST = NODE_ENV === Environment.test;
