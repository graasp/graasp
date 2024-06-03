import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { APPS_JWT_SECRET } from '../../../../../utils/config';
import { UnauthorizedMember } from '../../../../../utils/errors';
import { ItemRepository } from '../../../../item/repository';
import { Member } from '../../../../member/entities/member';
import { MemberRepository } from '../../../../member/repository';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

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
        let member: Member | undefined;
        try {
          member = await memberRepository.get(memberId);
        } catch (err) {
          // Member can be undefined if authorized.
          if (strict) {
            done(options?.spreadException ? err : new UnauthorizedMember(), false);
          }
        }
        try {
          const item = await itemRepository.get(itemId);
          done(null, {
            member,
            app: {
              item,
              origin,
              key,
            },
          });
        } catch (err) {
          // Exception occurred while fetching item
          done(options?.spreadException ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
