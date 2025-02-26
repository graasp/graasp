import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { db } from '../../../../../drizzle/db';
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
      async ({ sub, emailValidation }, done: StrictVerifiedCallback) => {
        try {
          const member = await memberRepository.get(db, sub);
          if (member) {
            // Token has been validated
            return done(null, { account: member }, { emailValidation });
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
