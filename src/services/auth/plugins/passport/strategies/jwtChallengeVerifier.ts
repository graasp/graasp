import crypto from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { JWT_SECRET } from '../../../../../utils/config';
import { ChallengeFailed } from '../../../../../utils/errors';
import MemberRepository from '../../../../member/repository';
import { PassportStrategy } from '../strategies';

export default (passport: Authenticator, memberRepository: typeof MemberRepository) => {
  passport.use(
    PassportStrategy.JWT_CHALLENGE_VERIFIER,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromBodyField('t'),
        secretOrKey: JWT_SECRET,
        passReqToCallback: true,
      },
      async ({ body: { verifier } }, { sub, challenge }, done) => {
        if (challenge === crypto.createHash('sha256').update(verifier).digest('hex')) {
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
              return done(err, false);
            });
        } else {
          // Challenge failed
          // Error is defined, user is false
          return done(new ChallengeFailed(), false);
        }
      },
    ),
  );
};
