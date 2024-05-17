import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { REFRESH_TOKEN_JWT_SECRET } from '../../../../../utils/config';
import MemberRepository from '../../../../member/repository';
import { PassportStrategy } from '../strategies';

export default (passport: Authenticator, memberRepository: typeof MemberRepository) => {
  passport.use(
    PassportStrategy.REFRESH_TOKEN,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: REFRESH_TOKEN_JWT_SECRET,
      },
      async ({ sub: uuid }, done) => {
        memberRepository
          .get(uuid)
          .then((member) => {
            if (member) {
              // Token has been validated
              // Error is null, user payload contains the UUID.
              done(null, { uuid });
            } else {
              // Authentication refused
              // Error is null, user is false
              return done(null, false);
            }
          })
          .catch((_err) => {
            // Should return err here. But we don't because of the original implementation
            return done(null, false);
          });
      },
    ),
  );
};
