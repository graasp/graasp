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
      ({ sub }, done: StrictVerifiedCallback) => {
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
      },
    ),
  );
};
