import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { PASSWORD_RESET_JWT_SECRET } from '../../../../../utils/config.js';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors.js';
import { MemberPasswordService } from '../../password/service.js';
import { PassportStrategy } from '../strategies/index.js';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types.js';

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
            options?.propagateError ? new MemberNotFound(uuid) : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
