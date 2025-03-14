import { Strategy } from 'passport-local';

import { Authenticator } from '@fastify/passport';

import { db } from '../../../../../drizzle/db.js';
import { UnauthorizedMember } from '../../../../../utils/errors.js';
import { MemberPasswordService } from '../../password/service.js';
import { PassportStrategy } from '../strategies.js';
import { CustomStrategyOptions } from '../types.js';

export default (
  passport: Authenticator,
  memberPasswordService: MemberPasswordService,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.Password,
    new Strategy(
      {
        usernameField: 'email',
      },
      async (email, password, done) => {
        try {
          const member = await memberPasswordService.authenticate(db, email, password);
          if (member) {
            // Token has been validated
            return done(null, { account: member });
          } else {
            // Authentication refused
            return done(new UnauthorizedMember(), false);
          }
        } catch (err) {
          // Exception occurred while authenticating member
          return done(options?.propagateError ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
