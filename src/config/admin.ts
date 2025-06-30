import { getEnv } from './env';
import { requiredEnvVar } from './helpers';

// ensure env is setup
getEnv();

// GitHub OAuth app secrets
// to generate these values go to: Settings -> Developer Settings -> OAuth Apps -> New OAuth app
// the callback url should be <your-origin>/admin/auth/github/callback
// so for local developement: http://localhost:3000/admin/auth/github/callback
export const GITHUB_CLIENT_ID = requiredEnvVar('GITHUB_CLIENT_ID');
export const GITHUB_CLIENT_SECRET = requiredEnvVar('GITHUB_CLIENT_SECRET');
