import crypto from 'crypto';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import jwt from 'jsonwebtoken';

import { HttpMethod, MemberType } from '@graasp/sdk';

import { DEFAULT_LANG, JWT_SECRET, REFRESH_TOKEN_JWT_SECRET } from '../src/util/config';
import build from './app';
import * as MEMBERS_FIXTURES from './fixtures/members';
import { Member } from '../src/services/members/member';
import { MemberPassword } from '../src/plugins/auth/entities/password';

export const expectMember = (m, validation) => {
  if (!m) {
    throw 'member does not exist';
  }
  expect(m.name).toEqual(validation.name);
  expect(m.email).toEqual(validation.email);
  expect(m.type).toEqual(validation.type ?? MemberType.Individual);
  expect(m.extra).toEqual(validation.extra ?? { lang: DEFAULT_LANG });

};

// mock database and decorator plugins
jest.mock('../src/plugins/database');
jest.mock('../src/plugins/decorator');


describe('Auth routes tests', () => {
  let app;
  let memberRepository;
  let memberPasswordRepository;


  const saveMember = async (m) => {
    const member = new Member();
    Object.assign(member, m);
    await memberRepository.save(member);

    if (m.password) {
      await memberPasswordRepository.save({ member, password: m.password });
    }
  };

  beforeEach(async () => {
    
    app = await build();
    
    memberPasswordRepository = app.db.getRepository(MemberPassword);
    memberRepository = app.db.getRepository(Member);
  });
  
  afterEach(async () => {
    jest.clearAllMocks();
    await memberPasswordRepository.clear();
    await memberRepository.clear();
    app.close();
  });

  describe('POST /register', () => {
    it('Sign Up successfully', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      // const mockCreate = mockMemberServiceCreate();
      // const mockSendRegisterEmail = jest.spyOn(app.mailer, 'sendRegisterEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: { email, name },
      });

      const m = await memberRepository.findOneBy({ email, name });

      expectMember(m, { name, email });

      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up successfully with given lang', async () => {
      const email = 'someemail@email.com';
      const name = 'anna';
      const lang = 'fr';

      // const mockSendRegisterEmail = jest.spyOn(app.mailer, 'sendRegisterEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/register?lang=${lang}`,
        payload: { email, name },
      });

      // expect(mockSendRegisterEmail).toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.anything(),
      //   lang,
      // );
      const m = await memberRepository.findOneBy({ email, name });
      expectMember(m, { name, email, extra: { lang } });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign Up fallback to login for already register member', async () => {
      // register already existing member
      const member = MEMBERS_FIXTURES.BOB;
      await saveMember(member);
      // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: member,
      });

      // expect(mockSendLoginEmail).toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.anything(),
      //   expect.anything(),
      //   member.extra.lang,
      // );

      const members = await memberRepository.find({ email: member.email });
      expect(members).toHaveLength(1);
      expectMember(member, members[0]);

      expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const name = 'anna';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/register',
        payload: { email, name },
      });

      const members = await memberRepository.find({ email });
      expect(members).toHaveLength(0);

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /login', () => {
    it('Sign In successfully', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      await saveMember(member);
      // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login',
        payload: { email: member.email },
      });

      // expect(mockSendLoginEmail).toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.anything(),
      //   null,
      //   member.extra.lang,
      // );
      // expect(mockSendLoginEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In successfully with given lang', async () => {
      const member = MEMBERS_FIXTURES.ANNA;
      const { lang } = member.extra;
      await saveMember(member);
      // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: `/login?lang=${lang}`,
        payload: { email: member.email },
      });

      // expect(mockSendLoginEmail).toHaveBeenCalledWith(
      //   expect.anything(),
      //   expect.anything(),
      //   null,
      //   lang,
      // );
      // expect(mockSendLoginEmail).toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Sign In does send not found on non-existing email', async () => {
      const email = 'some@email.com';

      // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login',
        payload: { email },
      });

      // expect(mockSendLoginEmail).not.toHaveBeenCalled();
      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      app.close();
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login',
        payload: { email },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('POST /login-password', () => {
    it('Sign In successfully', async () => {
      const member = MEMBERS_FIXTURES.LOUISA;
      const clearPassword = 'asd';

      await saveMember(member);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email: member.email, password: clearPassword },
      });

      expect(response.statusCode).toEqual(StatusCodes.SEE_OTHER);
      expect(response.json()).toHaveProperty('resource');
    });

    it('Sign In does send unauthorized error for wrong password', async () => {
      const member = MEMBERS_FIXTURES.LOUISA;
      const clearWrongPassword = '1234';
      await saveMember(member);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email: member.email, password: clearWrongPassword },
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
    });

    it('Sign In does send not acceptable error when member does not have password', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      const clearPassword = 'asd';
      await saveMember(member);

      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email: member.email, password: clearPassword },
      });
      expect(response.statusCode).toEqual(StatusCodes.NOT_ACCEPTABLE);
      expect(response.statusMessage).toEqual(ReasonPhrases.NOT_ACCEPTABLE);
    });

    it('Sign In send not found error for non-existing email', async () => {
      const email = 'some@email.com';
      const password = '1234';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email, password },
      });

      expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      expect(response.statusMessage).toEqual(ReasonPhrases.NOT_FOUND);
    });

    it('Bad request for invalid email', async () => {
      const email = 'wrongemail';
      const password = '1234';
      const response = await app.inject({
        method: HttpMethod.POST,
        url: '/login-password',
        payload: { email, password },
      });

      expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
      expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    });
  });

  describe('GET /auth', () => {
    it('Authenticate successfully', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      await saveMember(member);
      const t = jwt.sign(member, JWT_SECRET);
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });

    it('Fail to authenticate if token is invalid', async () => {
      const member = MEMBERS_FIXTURES.BOB;
      await saveMember(member);
      const t = jwt.sign(member, 'secret');
      const response = await app.inject({
        method: HttpMethod.GET,
        url: `/auth?t=${t}`,
      });
      expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    });
  });

  describe('GET /logout', () => {
    it('Authenticate successfully', async () => {
      const response = await app.inject({
        method: HttpMethod.GET,
        url: '/logout',
      });
      expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    });
  });

  describe('Mobile Endpoints', () => {
    const challenge = 'challenge';

    describe('POST /m/register', () => {
      it('Sign Up successfully', async () => {
        const email = 'someemail@email.com';
        const name = 'anna';

        // const mockSendRegisterEmail = jest.spyOn(app.mailer, 'sendRegisterEmail');
        const response = await app.inject({
          method: HttpMethod.POST,
          url: '/m/register',
          payload: { email, name, challenge },
        });

        const m = await memberRepository.findOneBy({email});
        expectMember(m, { email, name });

        // expect(mockSendRegisterEmail).toHaveBeenCalled();
        // expect(mockCreate).toHaveBeenCalledWith(
        //   { email, name, extra: expect.objectContaining({ lang: DEFAULT_LANG }) },
        //   expect.anything(),
        // );
        expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
      });

          it('Sign Up successfully with given lang', async () => {
            const email = 'someemail@email.com';
            const name = 'anna';
            const lang = 'fr';
            const member = {email,name,extra:{lang}};

            // const mockSendRegisterEmail = jest.spyOn(app.mailer, 'sendRegisterEmail');
            const response = await app.inject({
              method: HttpMethod.POST,
              url: `/m/register?lang=${lang}`,
              payload: { email, name, challenge },
            });

            // expect(mockSendRegisterEmail).toHaveBeenCalledWith(
            //   expect.anything(),
            //   expect.anything(),
            //   lang,
            // );

            const m = await memberRepository.findOneBy({email});
            expectMember(m, member);

            
            expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
          });

          it('Sign Up fallback to login for already register member', async () => {
            const member = MEMBERS_FIXTURES.BOB;
            await saveMember(member);

            // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
            const response = await app.inject({
              method: HttpMethod.POST,
              url: '/m/register',
              payload: { ...member, challenge },
            });

            // expect(mockSendLoginEmail).toHaveBeenCalledWith(
            //   expect.anything(),
            //   expect.anything(),
            //   expect.anything(),
            //   member.extra.lang,
            // );
            const m = await memberRepository.findOneBy({email:member.email});
            expectMember(m, member);

            expect(response.statusCode).toEqual(StatusCodes.CONFLICT);
          });

          it('Bad request for invalid email', async () => {
            const email = 'wrongemail';
            const name = 'anna';
            const response = await app.inject({
              method: HttpMethod.POST,
              url: '/m/register',
              payload: { email, name },
            });

            expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
            expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
          });
    });

      describe('POST /m/login', () => {
        it('Sign In successfully', async () => {
          const member = MEMBERS_FIXTURES.BOB;
await saveMember(member);
          // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
          const response = await app.inject({
            method: HttpMethod.POST,
            url: '/m/login',
            payload: { email: member.email, challenge },
          });

          // expect(mockSendLoginEmail).toHaveBeenCalledWith(
          //   expect.anything(),
          //   expect.anything(),
          //   false,
          //   member.extra.lang,
          // );
          expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
        });

        it('Sign In successfully with given lang', async () => {
          const member = MEMBERS_FIXTURES.ANNA;
          const lang = 'de';
          await saveMember(member);
          // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
          const response = await app.inject({
            method: HttpMethod.POST,
            url: `/m/login?lang=${lang}`,
            payload: { email: member.email, challenge },
          });
          expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
          // expect(mockSendLoginEmail).toHaveBeenCalledWith(
          //   expect.anything(),
          //   expect.anything(),
          //   false,
          //   lang,
          // );
        });

        it('Sign In does send not found error for non-existing email', async () => {
          const email = 'some@email.com';
          // const mockSendLoginEmail = jest.spyOn(app.mailer, 'sendLoginEmail');
          const response = await app.inject({
            method: HttpMethod.POST,
            url: '/m/login',
            payload: { email, challenge },
          });

          // expect(mockSendLoginEmail).not.toHaveBeenCalled();
          expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
        });

        it('Bad request for invalid email', async () => {
          const email = 'wrongemail';
          const response = await app.inject({
            method: HttpMethod.POST,
            url: '/m/login',
            payload: { email, challenge },
          });

          expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
          expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
        });
      });

      describe('POST /m/login-password', () => {
        it('Sign In successfully', async () => {
          const member = MEMBERS_FIXTURES.LOUISA;
          const clearPassword = 'asd';
          await saveMember(member);

          const response = await app.inject({
            method: HttpMethod.POST,
            url: '/m/login-password',
            payload: { email: member.email, challenge, password: clearPassword },
          });
          expect(response.statusCode).toEqual(StatusCodes.OK);
          expect(response.json()).toHaveProperty('t');
        });

        it.only('Sign In does send unauthorized error for wrong password', async () => {
          const member = MEMBERS_FIXTURES.LOUISA;
          const clearWrongPassword = '1234';
          const response = await app.inject({
            method: HttpMethod.POST,
            url: '/m/login-password',
            payload: { email: member.email, challenge, password: clearWrongPassword },
          });
          expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
          expect(response.statusMessage).toEqual(ReasonPhrases.UNAUTHORIZED);
        });

    //     it('Sign In send not acceptable error when member does not have password', async () => {
    //       const member = MEMBERS_FIXTURES.BOB;
    //       const clearPassword = 'asd';
    //       mockMemberServiceGetMatching([member]);
    //       const app = await build();
    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/m/login-password',
    //         payload: { email: member.email, challenge, password: clearPassword },
    //       });
    //       expect(response.statusCode).toEqual(StatusCodes.NOT_ACCEPTABLE);
    //       expect(response.statusMessage).toEqual(ReasonPhrases.NOT_ACCEPTABLE);
    //       app.close();
    //     });

    //     it('Sign In send not found error for non-existing email', async () => {
    //       const email = 'some@email.com';
    //       const password = '1234';
    //       const app = await build();
    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/m/login-password',
    //         payload: { email, challenge, password },
    //       });

    //       expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
    //       expect(response.statusMessage).toEqual(ReasonPhrases.NOT_FOUND);
    //       app.close();
    //     });

    //     it('Bad request for invalid email', async () => {
    //       const email = 'wrongemail';
    //       const password = '1234';
    //       const app = await build();
    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/m/login-password',
    //         payload: { email, challenge, password },
    //       });

    //       expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    //       expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
    //       app.close();
    //     });
      });

    //   describe('GET /m/auth', () => {
    //     it('Authenticate successfully', async () => {
    //       const member = MEMBERS_FIXTURES.BOB;
    //       const verifier = 'verifier';
    //       // compute challenge from verifier
    //       const challenge = crypto.createHash('sha256').update(verifier).digest('hex');
    //       // mock verification
    //       jest.spyOn(jwt, 'verify').mockImplementation(() => {
    //         return { sub: member.id, challenge };
    //       });

    //       const app = await build();
    //       const t = jwt.sign({ sub: member.id, challenge }, JWT_SECRET);

    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/m/auth',
    //         payload: {
    //           t,
    //           verifier,
    //         },
    //       });
    //       expect(response.statusCode).toEqual(StatusCodes.OK);
    //       expect(response.json()).toHaveProperty('refreshToken');
    //       expect(response.json()).toHaveProperty('authToken');
    //       app.close();
    //     });
    //     it('Fail to authenticate if verifier and challenge do not match', async () => {
    //       const app = await build();
    //       const member = MEMBERS_FIXTURES.BOB;
    //       const t = jwt.sign(member, JWT_SECRET);
    //       const verifier = 'verifier';
    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/m/auth',
    //         payload: {
    //           t,
    //           verifier,
    //         },
    //       });
    //       expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    //       expect(response.json().message).toEqual('challenge fail');
    //       app.close();
    //     });
    //     it('Fail to authenticate if token is invalid', async () => {
    //       const app = await build();
    //       const t = 'sometoken';
    //       const verifier = 'verifier';
    //       const response = await app.inject({
    //         method: HttpMethod.POST,
    //         url: '/m/auth',
    //         payload: {
    //           t,
    //           verifier,
    //         },
    //       });
    //       expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    //       app.close();
    //     });
    //   });

    //   describe('GET /m/auth/refresh', () => {
    //     it('Refresh tokens successfully', async () => {
    //       const app = await build();
    //       const member = MEMBERS_FIXTURES.BOB;
    //       const t = jwt.sign(member, REFRESH_TOKEN_JWT_SECRET);
    //       const response = await app.inject({
    //         method: HttpMethod.GET,
    //         url: '/m/auth/refresh',
    //         headers: {
    //           authorization: `Bearer ${t}`,
    //         },
    //       });
    //       expect(response.statusCode).toEqual(StatusCodes.OK);
    //       expect(response.json()).toHaveProperty('refreshToken');
    //       expect(response.json()).toHaveProperty('authToken');
    //       app.close();
    //     });
    //     it('Fail if token is invalid', async () => {
    //       const app = await build();
    //       const member = MEMBERS_FIXTURES.BOB;
    //       const t = jwt.sign(member, 'REFRESH_TOKEN_JWT_SECRET');
    //       const response = await app.inject({
    //         method: HttpMethod.GET,
    //         url: '/m/auth/refresh',
    //         headers: {
    //           authorization: `Bearer ${t}`,
    //         },
    //       });
    //       expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
    //       app.close();
    //     });
    //   });

    //   describe('GET /m/deep-link', () => {
    //     it('Refresh tokens successfully', async () => {
    //       const app = await build();
    //       const member = MEMBERS_FIXTURES.BOB;
    //       const t = jwt.sign(member, JWT_SECRET);
    //       const response = await app.inject({
    //         method: HttpMethod.GET,
    //         url: `/m/deep-link?t=${t}`,
    //       });
    //       expect(response.headers['content-type']).toEqual('text/html');
    //       expect(response.statusCode).toEqual(StatusCodes.OK);
    //       app.close();
    //     });
    //   });
  });
});
