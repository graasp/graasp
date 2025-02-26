import crypto from 'crypto';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { AuthenticatedUser } from '../../../../../types';
import { JWT_SECRET } from '../../../../../utils/config';
import { ChallengeFailed, MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { AccountRepository } from '../../../../account/repository';
import { SHORT_TOKEN_PARAM } from '../constants';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  accountRepository: AccountRepository,
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
      async (
        { body: { verifier } },
        { sub, challenge, emailValidation },
        done: StrictVerifiedCallback,
      ) => {
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
          // HACK: We cast here, but in the future we should only retrieve the minimal info
          const account = (await accountRepository.get(sub)) as AuthenticatedUser;
          if (account) {
            // Token has been validated
            return done(null, { account }, { emailValidation });
          } else {
            // Authentication refused
            return done(
              spreadException ? new MemberNotFound({ id: sub }) : new UnauthorizedMember(),
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
