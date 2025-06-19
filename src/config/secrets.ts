import { getEnv } from './env';
import { requiredEnvVar } from './helpers';

// ensure env is setup
getEnv();

/**
 * Session cookie key
 */
export const SECURE_SESSION_SECRET_KEY = requiredEnvVar('SECURE_SESSION_SECRET_KEY');
export const SECURE_SESSION_EXPIRATION_IN_SECONDS = 604800; // 7days
export const MAX_SECURE_SESSION_EXPIRATION_IN_SECONDS = 15552000; // 6 * 30days -> 6 months

/**
 * JWT
 */
export const JWT_SECRET = requiredEnvVar('JWT_SECRET');
/** Register token expiration, in minutes */
export const REGISTER_TOKEN_EXPIRATION_IN_MINUTES = 60;
/** Login token expiration, in minutes */
export const LOGIN_TOKEN_EXPIRATION_IN_MINUTES = 30;

/** Password reset token Secret */
export const PASSWORD_RESET_JWT_SECRET: string = requiredEnvVar('PASSWORD_RESET_JWT_SECRET');
/** Password reset token expiration, in minutes */
export const PASSWORD_RESET_JWT_EXPIRATION_IN_MINUTES = 1440; // 24 hours

/** Email change token Secret */
export const EMAIL_CHANGE_JWT_SECRET: string = requiredEnvVar('EMAIL_CHANGE_JWT_SECRET');
/** Email change token expiration, in minutes */
export const EMAIL_CHANGE_JWT_EXPIRATION_IN_MINUTES = 1440; // 24 hours

/** Graasp apps authentication */
export const APPS_JWT_SECRET = requiredEnvVar('APPS_JWT_SECRET');

export const REFRESH_TOKEN_JWT_SECRET = requiredEnvVar('REFRESH_TOKEN_JWT_SECRET');
