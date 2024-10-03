import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { MailBuilder } from '../builder';
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

  describe('MailBuilder', () => {
    const email = 'toto@toto.com';
    const lang = 'fr';
    const link = 'http//localhost:3000';
    const itemName = 'specific item';
    const memberName = 'respectedMember';

    it('addButton generates button given link and text', () => {
      const link = 'mylink';
      const text = 'mytext';

      const mail = new MailBuilder({
        subject: 'subject',
        translationVariables: {},
      })
        .addButton(text, link)
        .build();

      expect(mail.html).toContain(link);
      expect(mail.html).toContain(text);
      expect(mail.text).toContain(link);
    });

    it('addText generates text paragraph', () => {
      const text = 'mytext';

      const mail = new MailBuilder({
        subject: 'subject',
        translationVariables: {},
      })
        .addText(text)
        .build();

      expect(mail.text).toContain(text);
      expect(mail.html).toContain(text);
    });

    it('builds mail', async () => {
      const mail = new MailBuilder({
        subject: MAIL.MEMBERSHIP_REQUEST_TITLE,
        translationVariables: { itemName, memberName },
        lang: lang,
      })
        .addText(MAIL.MEMBERSHIP_REQUEST_TEXT)
        .addButton(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, link)
        .build();

      await mailerService.send(mail, email);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.stringContaining(memberName),
        email,
        expect.stringContaining(link),
        expect.stringContaining(itemName) && expect.stringContaining(link),
        expect.stringContaining('Graasp'),
        expect.anything(),
      );
    });

    it('translation escapes special characters in text, but not in subject', async () => {
      const itemName = 'very Cool Item name>';
      const memberName = 'Member007';

      const mail = new MailBuilder({
        subject: MAIL.MEMBERSHIP_REQUEST_TITLE,
        translationVariables: { itemName, memberName },
        lang: lang,
      })
        .addText(MAIL.MEMBERSHIP_REQUEST_TEXT)
        .addButton(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, link)
        .build();

      await mailerService.send(mail, email);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.stringContaining(itemName),
        email,
        expect.stringContaining(link),
        expect.stringContaining(itemName.slice(0, -1).concat('&gt;')),
        expect.anything(),
        expect.anything(),
      );
    });

    it('user agreement and sign up not requested blocks are generated', async () => {
      const mail = new MailBuilder({
        subject: MAIL.MEMBERSHIP_REQUEST_TITLE,
        translationVariables: { itemName, memberName },
      })
        .addText(MAIL.MEMBERSHIP_REQUEST_TEXT)
        .addButton(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, link)
        .includeUserAgreement()
        .signUpNotRequested()
        .build();

      await mailerService.send(mail, email);

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
        expect.anything(),
      );
    });
  });
});
