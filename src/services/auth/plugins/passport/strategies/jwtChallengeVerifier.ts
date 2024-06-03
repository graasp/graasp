import crypto from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { JWT_SECRET } from '../../../../../utils/config';
import { ChallengeFailed, MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { MemberRepository } from '../../../../member/repository';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.JWT_CHALLENGE_VERIFIER,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromBodyField('t'),
        secretOrKey: JWT_SECRET,
        passReqToCallback: true,
      },
      async ({ body: { verifier } }, { sub, challenge }, done: StrictVerifiedCallback) => {
        if (challenge === crypto.createHash('sha256').update(verifier).digest('hex')) {
          memberRepository
            .get(sub)
            .then((member) => {
              if (member) {
                // Token has been validated
                done(null, { member });
              } else {
                // Authentication refused
                done(
                  options?.spreadException ? new MemberNotFound(sub) : new UnauthorizedMember(),
                  false,
                );
              }
            })
            .catch((err) => {
              // Exception occurred while fetching member
              done(options?.spreadException ? err : new UnauthorizedMember(), false);
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
