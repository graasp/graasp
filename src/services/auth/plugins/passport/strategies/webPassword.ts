import { Strategy } from 'passport-local';

import { Authenticator } from '@fastify/passport';

import { Repositories } from '../../../../../utils/repositories';
import { Member } from '../../../../member/entities/member';
import { MemberPasswordService } from '../../password/service';
import { PassportStrategy } from '../strategies';

export default (
  passport: Authenticator,
  memberPasswordService: MemberPasswordService,
  repositories: Repositories,
) => {
  passport.use(
    PassportStrategy.WEB_PASSWORD,
    new Strategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      (email, password, done) => {
        memberPasswordService
          .authenticate(repositories, email, password)
          .then((member?: Member) => {
            if (member) {
              // Token has been validated
              // Error is undefined, req.user is the Password Reset Request UUID.
              done(null, { uuid: member.id });
            } else {
              // Authentication refused
              // Error is undefined, user is false to trigger a 401 Unauthorized.
              done(null, false);
            }
          })
          .catch((err) => {
            // Authentication refused
            // Error is defined, user is false to trigger a 401 Unauthorized.
            done(err, false);
          });
      },
    ),
  );
};
