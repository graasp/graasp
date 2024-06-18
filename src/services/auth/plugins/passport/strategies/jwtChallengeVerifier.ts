import crypto from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { JWT_SECRET } from '../../../../../utils/config.js';
import {
  ChallengeFailed,
  MemberNotFound,
  UnauthorizedMember,
} from '../../../../../utils/errors.js';
import { MemberRepository } from '../../../../member/repository.js';
import { SHORT_TOKEN_PARAM } from '../constants.js';
import { PassportStrategy } from '../strategies.js';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types.js';

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.JwtChallengeVerifier,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromBodyField(SHORT_TOKEN_PARAM),
        secretOrKey: JWT_SECRET,
        passReqToCallback: true,
      },
      async ({ body: { verifier } }, { sub, challenge }, done: StrictVerifiedCallback) => {
        const spreadException: boolean = options?.propagateError ?? false;
        //-- Verify Challenge --//
        try {
          const verifierChallenge = crypto.createHash('sha256').update(verifier).digest('hex');
          if (challenge !== verifierChallenge) {
            // Challenge failed
            // Error is defined, user is false
            return done(spreadException ? new ChallengeFailed() : new UnauthorizedMember(), false);
          }
        } catch (err) {
          // Exception occurred while comparing challenge
          return done(spreadException ? new ChallengeFailed() : new UnauthorizedMember(), false);
        }

        //-- Fetch Member Data --//
        try {
          const member = await memberRepository.get(sub);
          if (member) {
            // Token has been validated
            return done(null, { member });
          } else {
            // Authentication refused
            return done(
              spreadException ? new MemberNotFound(sub) : new UnauthorizedMember(),
              false,
            );
          }
        } catch (err) {
          // Exception occurred while fetching member
          return done(spreadException ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
