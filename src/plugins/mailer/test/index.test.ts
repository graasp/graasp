import { FastifyInstance } from 'fastify';

import { SUCCESS_MESSAGES } from '@graasp/translations';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { MAIL } from '../langs/constants';
import { MailerService } from '../service';

describe('Mailer', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;
  let mockSendEmail;

  beforeAll(async () => {
    ({ app } = await build());
    mailerService = resolveDependency(MailerService);
  });

  beforeEach(async () => {
    mockSendEmail = jest
      .spyOn(mailerService, 'sendEmail')
      .mockImplementation(async () => Promise.resolve());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('buildButton', () => {
    it('generates button given link and text', () => {
      const link = 'mylink';
      const text = 'mytext';

      // this is a hack to get the private function of the class
      const mailerServiceProto = Object.getPrototypeOf(mailerService);
      const button = mailerServiceProto.buildButton(link, text);

      expect(button).toContain(link);
      expect(button).toContain(text);
    });
  });

  describe('buildText', () => {
    it('generates text paragraph', () => {
      const text = 'mytext';

      // this is a hack to get the private function of the class
      const mailerServiceProto = Object.getPrototypeOf(mailerService);
      const result = mailerServiceProto.buildText(text);

      expect(result).toContain(text);
    });
  });

  describe('translate', () => {
    it('generates button given link and text', () => {
      const translate = mailerService.translate('fr');
      expect(translate(SUCCESS_MESSAGES.COPY_ITEM).length).toBeGreaterThan(1);
    });
  });

  describe('composeMail', () => {
    const email = 'toto@toto.com';
    const lang = 'fr';
    const link = 'http//localhost:3000';
    const itemName = 'specific item';
    const memberName = 'respectedMember';

    it('composes mail', async () => {
      await mailerService.composeAndSendEmail(
        email,
        lang,
        MAIL.MEMBERSHIP_REQUEST_TITLE,
        MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT,
        MAIL.MEMBERSHIP_REQUEST_TEXT,
        { itemName, memberName },
        link,
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.stringContaining(memberName),
        email,
        expect.stringContaining(link),
        expect.stringContaining(itemName) && expect.stringContaining(link),
        expect.stringContaining('Graasp'),
      );
    });

    it('translation escapes special characters in text, but not in subject', async () => {
      const itemName = 'very Cool Item name>';
      const memberName = 'Member007';

      mailerService.composeAndSendEmail(
        email,
        lang,
        MAIL.MEMBERSHIP_REQUEST_TITLE,
        MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT,
        MAIL.MEMBERSHIP_REQUEST_TEXT,
        { itemName, memberName },
        link,
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.stringContaining(itemName),
        email,
        expect.stringContaining(link),
        expect.stringContaining(itemName.slice(0, -1).concat('&gt;')),
        expect.anything(),
      );
    });

    it('user agreement and sign up not requested blocks are generated', async () => {
      await mailerService.composeAndSendEmail(
        email,
        'en',
        MAIL.MEMBERSHIP_REQUEST_TITLE,
        MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT,
        MAIL.MEMBERSHIP_REQUEST_TEXT,
        { itemName, memberName },
        link,
        true,
        true,
      );

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.stringContaining(memberName),
        email,
        expect.stringContaining(link),
        expect.stringContaining(
          "If you haven't requested the link, no further action is required.",
        ) &&
          expect.stringContaining('terms of service') &&
          expect.stringContaining('privacy policy'),
        expect.stringContaining('Graasp'),
      );
    });
  });
});
