import { ExtractJwt, Strategy } from 'passport-jwt';

import { Authenticator } from '@fastify/passport';

import { JWT_SECRET } from '../../../../../utils/config';
import { Repositories } from '../../../../../utils/repositories';
import { MagicLinkService } from '../../magicLink/service';
import { PassportStrategy } from '../strategies';

export default (
  passport: Authenticator,
  magicLinkService: MagicLinkService,
  repositories: Repositories,
) => {
  passport.use(
    PassportStrategy.WEB_MAGIC_LINK,
    new Strategy(
      {
        jwtFromRequest: ExtractJwt.fromUrlQueryParameter('t'),
        secretOrKey: JWT_SECRET,
      },
      (
        payload: {
          sub: string;
          challenge?: string | undefined;
        },
        done,
      ) => {
        magicLinkService
          .validateMemberId(undefined, repositories, payload.sub)
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
