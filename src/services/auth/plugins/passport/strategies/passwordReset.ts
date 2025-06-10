import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { PASSWORD_RESET_JWT_SECRET } from '../../../../../utils/config';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { MemberPasswordService } from '../../password/password.service';
import { PassportStrategy } from '../strategies';
import type { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberPasswordService: MemberPasswordService,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.PasswordReset,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: PASSWORD_RESET_JWT_SECRET,
      },
      async ({ uuid }, done: StrictVerifiedCallback) => {
        if (uuid && (await memberPasswordService.validatePasswordResetUuid(uuid))) {
          // Token has been validated
          return done(null, { passwordResetRedisKey: uuid });
        } else {
          // Authentication refused
          return done(
            options?.propagateError ? new MemberNotFound({ id: uuid }) : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
