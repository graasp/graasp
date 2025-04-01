import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { db } from '../../../../../drizzle/db';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { AccountRepository } from '../../../../account/account.repository';
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
          const account = await accountRepository.get(db, sub);
          if (account.exists()) {
            // Token has been validated
            return done(null, { account: account.toMaybeUser() });
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
