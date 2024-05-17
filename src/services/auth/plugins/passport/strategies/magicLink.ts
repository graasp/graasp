import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { Repositories } from '../../../../../utils/repositories';
import { AuthService } from '../../../service';
import { PassportStrategy } from '../strategies';

export default (
  passport: Authenticator,
  authService: AuthService,
  repositories: Repositories,
  strategy: PassportStrategy,
  tokenQueryParameter: string,
  jwtSecret: string,
) => {
  passport.use(
    strategy,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromUrlQueryParameter(tokenQueryParameter),
        secretOrKey: jwtSecret,
      },
      (
        payload: {
          sub: string;
          challenge?: string | undefined;
        },
        done,
      ) => {
        authService
          .validateMemberId(repositories, payload.sub)
          .then((validated) => {
            if (validated) {
              // Token has been validated
              // Error is null, req.user is the Password Reset Request UUID.
              done(null, { uuid: payload.sub });
            } else {
              // Authentication refused
              // Error is null, user is false
              done(null, false);
            }
          })
          .catch((err) => {
            // An error occured
            // Error is given, user is false.
            done(err, false);
          });
      },
    ),
  );
};
