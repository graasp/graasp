import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { PASSWORD_RESET_JWT_SECRET } from '../../../../../utils/config';
import { MemberNotFound, UnauthorizedMember } from '../../../../../utils/errors';
import { MemberPasswordService } from '../../password/service';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  memberPasswordService: MemberPasswordService,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.PASSPORT_RESET,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: PASSWORD_RESET_JWT_SECRET,
      },
      async ({ uuid }, done: StrictVerifiedCallback) => {
        if (uuid && (await memberPasswordService.validatePasswordResetUuid(uuid))) {
          // Token has been validated
          return done(null, { uuid });
        } else {
          // Authentication refused
          done(
            options?.spreadException ? new MemberNotFound(uuid) : new UnauthorizedMember(),
            false,
          );
        }
      },
    ),
  );
};
