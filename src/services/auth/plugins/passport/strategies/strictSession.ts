import { Strategy } from 'passport-custom';

import { Authenticator } from '@fastify/passport';

import { PassportStrategy } from '../strategies';
import type { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

/**
 * This strategy is similar to the built-in 'session' strategy, except it throws a 401 error if the user is not authenticated.
 */
export default (passport: Authenticator, _options?: CustomStrategyOptions) => {
  passport.use(
    PassportStrategy.StrictSession,
    new Strategy((req, done: StrictVerifiedCallback) => {
      const user = req.isAuthenticated() ? req.user : false;
      return done(null, user);
    }),
  );
};
