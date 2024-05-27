import { Strategy } from 'passport-custom';

import { Authenticator } from '@fastify/passport';

import { PassportStrategy } from '../strategies';

/**
 * This strategy is similar to the built-in 'session' strategy, except it throws a 401 error if the user is not authenticated.
 */
export default (passport: Authenticator) => {
  passport.use(
    PassportStrategy.STRICT_SESSION,
    new Strategy((req, done) => {
      const user = req.isAuthenticated() ? req.user : false;
      return done(null, user);
    }),
  );
};
