import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';
import { PassportUser } from 'fastify';

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
      async (payload, done) => {
        if (payload.uuid && (await memberPasswordService.validatePasswordResetUuid(payload.uuid))) {
          // Token has been validated
          // Error is null, payload contains the UUID.
          const user: PassportUser = { uuid: payload.uuid };
          return done(null, user);
        } else {
          // Authentication refused
          // Error is null, user is false to trigger a 401 Unauthorized.
          return done(null, false);
        }
      },
    ),
  );
};
