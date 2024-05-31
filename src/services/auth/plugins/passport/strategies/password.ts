import { Strategy } from 'passport-local';

import { Authenticator } from '@fastify/passport';

import { UnauthorizedMember } from '../../../../../utils/errors';
import { Repositories } from '../../../../../utils/repositories';
import { Member } from '../../../../member/entities/member';
import { MemberPasswordService } from '../../password/service';
import { PassportStrategy } from '../strategies';
import { CustomStrategyOptions, StrictVerifiedCallback } from '../types';

export default (
  passport: Authenticator,
  log: (msg: string) => void,
  memberPasswordService: MemberPasswordService,
  repositories: Repositories,
  options?: CustomStrategyOptions,
) => {
  passport.use(
    PassportStrategy.PASSWORD,
    new Strategy(
      {
        usernameField: 'email',
      },
      (email, password, done: StrictVerifiedCallback) => {
        memberPasswordService
          .authenticate(repositories, email, password)
          .then((member?: Member) => {
            if (member) {
              // Token has been validated
              done(null, { member });
            } else {
              // Authentication refused
              done(new UnauthorizedMember(), false);
            }
          })
          .catch((err) => {
            // Exception occurred
            log(err);
            done(options?.spreadException ? err : new UnauthorizedMember(), false);
          });
      },
    ),
  );
};
