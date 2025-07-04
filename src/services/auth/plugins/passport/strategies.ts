export enum PassportStrategy {
  //-- From Session --//
  // Be careful ! 'session' is a reserved strategy key in Passport. We shoudln't override it by using passport.use(...), except for test cases.
  Session = 'session',
  StrictSession = 'strict-session',

  //-- Magic Link Strategies (JWT) --//
  WebMagicLink = 'web-magic-link',

  //-- From JWT --//
  PasswordReset = 'password-reset-jwt',
  EmailChange = 'email-change-jwt',
  DeprecatedEmailChange = 'deprecated-email-change-jwt',
  JwtChallengeVerifier = 'jwt-challenge-verifier',
  AppsJwt = 'apps-jwt',
  OptionalAppsJwt = 'optional-apps-jwt',

  //-- From Password --//
  Password = 'password',
}
