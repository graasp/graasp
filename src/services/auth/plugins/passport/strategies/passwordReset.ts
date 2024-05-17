import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { PASSWORD_RESET_JWT_SECRET } from '../../../../../utils/config';
import { MemberPasswordService } from '../../password/service';
import { PassportStrategy } from '../strategies';

export default (passport: Authenticator, memberPasswordService: MemberPasswordService) => {
  passport.use(
    PassportStrategy.PASSPORT_RESET,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
        secretOrKey: PASSWORD_RESET_JWT_SECRET,
      },
      async ({ uuid }, done) => {
        if (uuid && (await memberPasswordService.validatePasswordResetUuid(uuid))) {
          // Token has been validated
          // Error is null, payload contains the UUID.
          return done(null, { uuid });
        } else {
          // Authentication refused
          // Error is null, user is false to trigger a 401 Unauthorized.
          return done(null, false);
        }
      },
    ),
  );
};
