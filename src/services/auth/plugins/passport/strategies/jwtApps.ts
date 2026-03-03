import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { APPS_JWT_SECRET } from '../../../../../config/secrets';
import { db } from '../../../../../drizzle/db';
import { UnauthorizedMember, buildError } from '../../../../../utils/errors';
import { AccountRepository } from '../../../../account/account.repository';
import { ItemRepository } from '../../../../item/item.repository';
import { PassportStrategy } from '../strategies';
import type { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  accountRepository: AccountRepository,
  itemRepository: ItemRepository,
  strategy: PassportStrategy,
  strict: boolean, // Throw 401 if member is not found
  options?: CustomStrategyOptions,
) => {
  passport.use(
    strategy,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: APPS_JWT_SECRET,
      },
      async (payload, done: StrictVerifiedCallback) => {
        const {
          sub: { accountId, itemId, key, origin },
        } = payload;
        // Check inputs
        if (!key || !origin || !itemId) {
          return done(null, false);
        }

        // Fetch Member datas
        const account = await accountRepository.get(db, accountId);

        // Member can be undefined if authorized.
        if (strict && !account.exists()) {
          return done(new UnauthorizedMember(), false);
        }

        // Fetch Item datas
        try {
          const item = await itemRepository.getOneOrThrow(db, itemId);
          return done(null, {
            account: account.toMaybeUser(),
            app: {
              item,
              origin,
              key,
            },
          });
        } catch (error: unknown) {
          // Exception occurred while fetching item
          // itemRepository.getOneOrThrow() can fail for many reasons like the item was not found, database error, etc.
          // To avoid leaking information, we prefer to return UnauthorizedMember error.
          return done(
            options?.propagateError ? buildError(error) : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
