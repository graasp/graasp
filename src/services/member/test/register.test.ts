import { faker } from '@faker-js/faker';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';

import { FastifyInstance } from 'fastify';

import { HttpMethod, MAX_USERNAME_LENGTH, MemberFactory, RecaptchaAction } from '@graasp/sdk';

import build, { clearDatabase, mockAuthenticate, unmockAuthenticate } from '../../../../test/app';
import { mockCaptchaValidation } from '../../../../test/utils';
import { resolveDependency } from '../../../di/utils';
import { MailerService } from '../../../plugins/mailer/mailer.service';
import { MOCK_CAPTCHA } from '../../auth/plugins/captcha/test/utils';
import { saveInvitations } from '../../item/plugins/invitation/test/utils';
import { expectMember, saveMember } from './fixtures/members';

const invitationRawRepository = AppDataSource.getRepository(Invitation);
const itemMembershipRawRepository = AppDataSource.getRepository(ItemMembership);
const memberRawRepository = AppDataSource.getRepository(Member);

jest.mock('node-fetch');
(fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { json: async () => ({ success: true, action: RecaptchaAction.SignUp, score: 1 }) } as any;
});

describe('POST /register', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;

  beforeAll(async () => {
    ({ app } = await build({ member: null }));
  });

  afterAll(async () => {
    await clearDatabase(app.db);
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
      url: '/register',
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
    const m = await memberRawRepository.findOneBy({ email: lowercaseEmail, name });

    expectMember(m, { name, email: lowercaseEmail });
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(m?.userAgreementsDate).toBeInstanceOf(Date);

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
    const m = await memberRawRepository.findOneBy({ email: lowercaseEmail, name });
    expectMember(m, { name, email: lowercaseEmail, extra: { lang } });
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(m?.userAgreementsDate).toBeInstanceOf(Date);
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

    const m = await memberRawRepository.findOneBy({ email });
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
    const m = await memberRawRepository.findOneBy({ email, name });
    expectMember(m, { name, email });
    expect(m?.enableSaveActions).toBe(enableSaveActions);
    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(m?.userAgreementsDate).toBeInstanceOf(Date);
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
    const m = await memberRawRepository.findOneBy({ email, name });
    expectMember(m, { name, email });
    expect(m?.enableSaveActions).toBe(enableSaveActions);
    // ensure that the user agreements are set for new registration
    expect(m?.userAgreementsDate).toBeDefined();
    expect(m?.userAgreementsDate).toBeInstanceOf(Date);
    expect(m?.lastAuthenticatedAt).toBeNull();
    expect(m?.isValidated).toBeFalsy();

    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
  });

  it('Sign Up fallback to login for already register member', async () => {
    // register already existing member
    const member = await saveMember(MemberFactory({ isValidated: false }));
    const mockSendEmail = jest.spyOn(mailerService, 'sendRaw');

    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/register',
      payload: { ...member, captcha: MOCK_CAPTCHA },
    });

    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail.mock.calls[0][1]).toBe(member.email);

    const members = await memberRawRepository.findBy({ email: member.email });
    expect(members).toHaveLength(1);
    expectMember(member, members[0]);
    expect(members[0]?.lastAuthenticatedAt).toBeNull();
    expect(members[0]?.isValidated).toBeFalsy();
    expect(response.statusCode).toEqual(StatusCodes.NO_CONTENT);
  });

  it('Bad request for invalid email', async () => {
    const email = 'wrongemail';
    const name = 'anna';
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/register',
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    const members = await memberRawRepository.findBy({ email });
    expect(members).toHaveLength(0);

    expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('Bad request if the username contains special characters', async () => {
    const email = faker.internet.email().toLowerCase();
    const name = '<div>%"^';
    const response = await app.inject({
      method: HttpMethod.Post,
      url: '/register',
      payload: { email, name, captcha: MOCK_CAPTCHA },
    });

    const members = await memberRawRepository.findBy({ email });
    expect(members).toHaveLength(0);

    expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
    expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
  });

  it('remove invitation on member registration and create memberships successfully', async () => {
    const actor = await saveMember();
    mockAuthenticate(actor);
    const { invitations } = await saveInvitations({ member: actor });

    const { id, email, item, permission } = invitations[0];

    // register
    await app.inject({
      method: HttpMethod.Post,
      url: '/register',
      payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
    });
    const member = await AppDataSource.getRepository(Member).findOneBy({ email });
    expect(member).not.toBeNull();
    // invitations should be removed and memberships created
    await new Promise((done) => {
      setTimeout(async () => {
        const savedInvitation = await invitationRawRepository.findOneBy({ id });
        expect(savedInvitation).toBeFalsy();
        const membership = await itemMembershipRawRepository.findOne({
          where: { permission, account: { id: member!.id }, item: { id: item.id } },
          relations: { account: true, item: true },
        });
        expect(membership).toBeTruthy();
        done(true);
      }, 1000);
    });
  });

  it('does not throw if no invitation found', async () => {
    const actor = await saveMember();
    mockAuthenticate(actor);
    await saveInvitations({ member: actor });

    const email = faker.internet.email().toLowerCase();
    const allInvitationsCount = await invitationRawRepository.count();
    const allMembershipsCount = await itemMembershipRawRepository.count();

    // register
    await app.inject({
      method: HttpMethod.Post,
      url: '/register',
      payload: { email, name: 'some-name', captcha: MOCK_CAPTCHA },
    });

    await new Promise((done) => {
      setTimeout(async () => {
        // all invitations and memberships should exist
        expect(await invitationRawRepository.count()).toEqual(allInvitationsCount);
        expect(await itemMembershipRawRepository.count()).toEqual(allMembershipsCount);

        done(true);
      }, 1000);
    });
  });
});
