import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { MemberRepository } from '../../../../member/repository';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberRepository: MemberRepository,
  strategy: PassportStrategy,
  tokenQueryParameter: string,
  jwtSecret: string,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    strategy,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromUrlQueryParameter(tokenQueryParameter),
        secretOrKey: jwtSecret,
      },
      async ({ sub }, done: StrictVerifiedCallback) => {
        try {
          const member = await memberRepository.get(sub);
          if (member) {
            // Token has been validated
            return done(null, { member });
          } else {
            // Authentication refused
            return done(
              options?.propagateError ? new MemberNotFound(sub) : new UnauthorizedMember(),
              false,
            );
          }
        } catch (err) {
          // Exception occurred while fetching member
          return done(options?.propagateError ? err : new UnauthorizedMember(), false);
        }
      },
    ),
  );
};
