import { faker } from '@faker-js/faker';
import { and, eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import waitForExpect from 'wait-for-expect';

import type { FastifyInstance } from 'fastify';

import { HttpMethod, MAX_USERNAME_LENGTH, MemberFactory, RecaptchaAction } from '@graasp/sdk';

import build, { MOCK_CAPTCHA, clearDatabase, unmockAuthenticate } from '../../../../test/app';
import { seedFromJson } from '../../../../test/mocks/seed';
import { mockCaptchaValidation } from '../../../../test/utils';
import { resolveDependency } from '../../../di/utils';
import { db } from '../../../drizzle/db';
import { accountsTable, invitationsTable, itemMembershipsTable } from '../../../drizzle/schema';
import type { MemberRaw } from '../../../drizzle/types';
import { MailerService } from '../../../plugins/mailer/mailer.service';
import { assertIsDefined } from '../../../utils/assertions';
import { expectMember } from './fixtures/members';

jest.mock('node-fetch');
(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { json: async () => ({ success: true, action: RecaptchaAction.SignUp, score: 1 }) } as any;
});

const getMemberByEmail = async (lowercaseEmail: string) => {
  return (await db.query.accountsTable.findFirst({
    where: eq(accountsTable.email, lowercaseEmail),
  })) as MemberRaw | undefined;
};

describe('POST /register', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  beforeEach(() => {
    // mock captcha validation
    mockCaptchaValidation(RecaptchaAction.SignUp);
    mailerService = resolveDependency(MailerService);
  });

  it('Sign Up successfully', async () => {
    const { email, name } = MemberFactory();
    const lowercaseEmail = email.toLowerCase();
    const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/api/register',
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    const m = await getMemberByEmail(lowercaseEmail);

    expectMember(m, { name, email: lowercaseEmail });
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();

    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(lowercaseEmail);
  });

  it('Sign Up successfully with given lang', async () => {
    const { email, name } = MemberFactory();
    const lowercaseEmail = email.toLowerCase();
    const lang = 'fr';

    const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/register?lang=${lang}`,
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(lowercaseEmail);
    const m = await getMemberByEmail(lowercaseEmail);
    expectMember(m, { name, email: lowercaseEmail, extra: { lang } });
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
  });

  it('Rejects if username is too long', async () => {
    const email = faker.internet.email().toLowerCase();
    const name = Array(MAX_USERNAME_LENGTH + 1).fill(() => 'a');

    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/register`,
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    const m = await getMemberByEmail(email);
    expect(m).toBeFalsy();
    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('Save actions is disabled when explicitly asked', async () => {
    const email = faker.internet.email().toLowerCase();
    const name = 'anna';
    const enableSaveActions = false;

    const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/register`,
      payload: { email, name, captcha: MOCK_CAPTCHA, enableSaveActions },
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(email);
    const m = await getMemberByEmail(email);
    expectMember(m, { name, email });
    expect(m?.enableSaveActions).toBe(enableSaveActions);
    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
  });

  it('Enable save actions when explicitly asked', async () => {
    const email = faker.internet.email().toLowerCase();
    const name = 'anna';
    const enableSaveActions = true;

    const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');
    const response = await app.inject({
      method: HttpMethod.Post,
      url: `/register`,
      payload: { email, name, enableSaveActions, captcha: MOCK_CAPTCHA },
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(email);
    const m = await getMemberByEmail(email);
    expectMember(m, { name, email });
    expect(m?.enableSaveActions).toBe(enableSaveActions);
    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
  });

  it('Sign Up fallback to login for already register member', async () => {
    // register already existing member
    const {
      members: [member],
    } = await seedFromJson({
      actor: null,
      members: [{ lastAuthenticatedAt: null, isValidated: false }],
    });

    const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/api/register',
      payload: { ...member, captcha: MOCK_CAPTCHA },
    });
    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);

    const members = await db.query.accountsTable.findMany({
      where: eq(accountsTable.email, member.email),
    });
    expect(members).toHaveLength(1);
    expect(members[0]?.lastAuthenticatedAt).toBeNull();
    expect(members[0]?.isValidated).toBeFalsy();
  });

  it('Bad request for invalid email', async () => {
    const email = 'wrongemail';
    const name = 'anna';
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/api/register',
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    const member = await getMemberByEmail(email);
    expect(member).toBeUndefined();

    expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('Bad request if the username contains special characters', async () => {
    const email = faker.internet.email().toLowerCase();
    const name = '<div>%"^';
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/api/register',
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    const member = await getMemberByEmail(email);
    expect(member).toBeUndefined();

    expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('remove invitation on member registration and create memberships successfully', async () => {
    const {
      invitations: [invitation],
    } = await seedFromJson({ actor: null, items: [{ invitations: [{}] }] });

    // register
    await app.inject({
      method: HttpMethod.Post,
      url: '/api/register',
      payload: { email: invitation.email, name: 'some-name', captcha: MOCK_CAPTCHA },
    });
    const member = await getMemberByEmail(invitation.email);
    expect(member).not.toBeNull();
    assertIsDefined(member);

    // invitations should be removed and memberships created
    await waitForExpect(async () => {
      const savedInvitation = await db.query.invitationsTable.findFirst({
        where: eq(invitationsTable.id, invitation.id),
      });
      expect(savedInvitation).toBeUndefined();

      const membership = await db.query.itemMembershipsTable.findFirst({
        where: and(
          eq(itemMembershipsTable.permission, invitation.permission),
          eq(itemMembershipsTable.accountId, member.id),
          eq(itemMembershipsTable.itemPath, invitation.itemPath),
        ),
      });
      expect(membership).toBeTruthy();
    }, 1000);
  });

  it('does not throw if no invitation found', async () => {
    const email = faker.internet.email().toLowerCase();
    // register
    await app.inject({
      method: HttpMethod.Post,
      url: '/api/register',
      payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
    });

    await new Promise((done) => {
      setTimeout(async () => {
        expect(await getMemberByEmail(email)).toBeDefined();

        done(true);
      }, 1000);
    });
  });
});
