export enum PassportStrategy {
  // Be careful ! 'session' is a reserved strategy key in Passport.
  PASSPORT_RESET = 'password-reset-jwt',

  MOBILE_MAGIC_LINK = 'mobile-magic-link',
  MOBILE_PASSWORD = 'mobile-password',

  WEB_MAGIC_LINK = 'web-magic-link',
  WEB_PASSWORD = 'web-password',
}
