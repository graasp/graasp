export enum PassportStrategy {
  //-- From Session --//
  // Be careful ! 'session' is a reserved strategy key in Passport. We shoudln't override it by using passport.use(...), except for test cases.
  SESSION = 'session',
  STRICT_SESSION = 'strict-session',

  //-- Magic Link Strategies (JWT) --//
  MOBILE_MAGIC_LINK = 'mobile-magic-link',
  WEB_MAGIC_LINK = 'web-magic-link',

  //-- From JWT --//
  PASSWORD_RESET = 'password-reset-jwt',
  JWT_CHALLENGE_VERIFIER = 'jwt-challenge-verifier',
  JWT = 'jwt',
  REFRESH_TOKEN = 'refresh-token',
  APPS_JWT = 'apps-jwt',
  OPTIONAL_APPS_JWT = 'optional-apps-jwt',

  //-- From Password --//
  PASSWORD = 'password',
}
