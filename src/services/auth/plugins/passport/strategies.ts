export enum PassportStrategy {
  // Be careful ! 'session' is a reserved strategy key in Passport. We shoudln't override it.
  SESSION = 'session',

  PASSPORT_RESET = 'password-reset-jwt',

  MOBILE_MAGIC_LINK = 'mobile-magic-link',

  WEB_MAGIC_LINK = 'web-magic-link',
  PASSWORD = 'password',

  JWT_CHALLENGE_VERIFIER = 'jwt-challenge-verifier',

  REFRESH_TOKEN = 'refresh-token',
  JWT = 'jwt',
}
