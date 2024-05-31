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
  log: (msg: string) => void,
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
        try {
          let member: Member | undefined;
          try {
            member = await memberRepository.get(memberId);
          } catch (err) {
            // Exception occurred
            log(err);
            if (strict) {
              done(options?.spreadException ? err : new UnauthorizedMember(), false);
            }
          }
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
          // Exception occurred
          log(err);
          done(options?.spreadException ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
