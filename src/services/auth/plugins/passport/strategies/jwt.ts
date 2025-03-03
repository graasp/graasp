import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { AuthenticatedUser } from '../../../../../types';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { AccountRepository } from '../../../../account/repository';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  accountRepository: AccountRepository,
  strategy: PassportStrategy,
  secretOrKey: string,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    strategy,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey,
      },
      async ({ sub }, done: StrictVerifiedCallback) => {
        try {
          // HACK: We cast here, but in the future we should only retrieve the minimal info
          const account = (await accountRepository.get(sub)) as AuthenticatedUser;
          if (account) {
            // Token has been validated
            return done(null, { account });
          } else {
            // Authentication refused
            return done(
              options?.propagateError ? new MemberNotFound({ id: sub }) : new UnauthorizedMember(),
              false,
            );
          }
        } catch (err) {
          // Exception occurred while fetching member
          return done(options?.propagateError ? (err as Error) : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
