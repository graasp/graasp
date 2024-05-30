import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { MemberRepository } from '../../../../member/repository';
import { PassportStrategy } from '../strategies';
import { StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberRepository: typeof MemberRepository,
  strategy: PassportStrategy,
  secretOrKey: string,
) => {
  passport.use(
    strategy,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey,
      },
      async ({ sub }, done: StrictVerifiedCallback) => {
        memberRepository
          .get(sub)
          .then((member) => {
            if (member) {
              // Token has been validated
              // Error is null, user payload contains the UUID.
              done(null, { member });
            } else {
              // Authentication refused
              // Error is null, user is false
              return done(null, false);
            }
          })
          .catch((err) => {
            // Exception occurred
            // Error is defined, user is false
            return done(err, false);
          });
      },
    ),
  );
};
