import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { JWT_SECRET } from '../../../../../utils/config';
import MemberRepository from '../../../../member/repository';
import { PassportStrategy } from '../strategies';

export default (passport: Authenticator, memberRepository: typeof MemberRepository) => {
  passport.use(
    PassportStrategy.JWT,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: JWT_SECRET,
      },
      async ({ sub }, done) => {
        memberRepository
          .get(sub)
          .then((member) => {
            if (member) {
              // Token has been validated
              // Error is null, user payload contains the UUID.
              done(null, member);
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
