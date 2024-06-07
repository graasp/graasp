import { Strategy } from 'passport-local';

import { Authenticator } from '@fastify/passport';

import { UnauthorizedMember } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { MemberPasswordService } from '../../password/service';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberPasswordService: MemberPasswordService,
  repositories: Repositories,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.Password,
    new Strategy(
      {
        usernameField: 'email',
      },
      async (email, password, done: StrictVerifiedCallback) => {
        try {
          const member = await memberPasswordService.authenticate(repositories, email, password);
          if (member) {
            // Token has been validated
            return done(null, { member });
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
