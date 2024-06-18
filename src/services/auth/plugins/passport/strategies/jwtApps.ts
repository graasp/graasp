import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { APPS_JWT_SECRET } from '../../../../../utils/config.js';
import { UnauthorizedMember } from '../../../../../utils/errors.js';
import { ItemRepository } from '../../../../item/repository.js';
import { Member } from '../../../../member/entities/member.js';
import { MemberRepository } from '../../../../member/repository.js';
import { PassportStrategy } from '../strategies/index.js';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types.js';

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
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
          sub: { memberId, itemId, key, origin },
        } = payload;
        // Check inputs
        if (!key || !origin || !itemId) {
          return done(null, false);
        }

        // Fetch Member datas
        let member: Member | undefined;
        try {
          member = await memberRepository.get(memberId);
        } catch (err) {
          // Member can be undefined if authorized.
          if (strict) {
            return done(options?.propagateError ? err : new UnauthorizedMember(), false);
          }
        }

        // Fetch Item datas
        try {
          const item = await itemRepository.get(itemId);
          return done(null, {
            member,
            app: {
              item,
              origin,
              key,
            },
          });
        } catch (err) {
          // Exception occurred while fetching item
          // itemRepository.get() can fail for many reasons like the item was not found, database error, etc.
          // To avoid leaking information, we prefer to return UnauthorizedMember error.
          return done(options?.propagateError ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
