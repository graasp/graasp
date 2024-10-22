import { faker } from '@faker-js/faker';

import { FastifyInstance } from 'fastify';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { MailBuilder } from '../builder';
import { MAIL } from '../langs/constants';
import enTranslations from '../langs/en.json';
import { MailerService } from '../service';

describe('Mailer', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;
  let mockSendEmail;

  beforeAll(async () => {
    ({ app } = await build());
    mailerService = resolveDependency(MailerService);
    mockSendEmail = jest
      .spyOn(mailerService, 'sendRaw')
      .mockImplementation(async () => Promise.resolve());
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('MailBuilder', () => {
    const email = faker.internet.email();
    const lang = 'fr';
    const link = faker.internet.url();
    const itemName = faker.lorem.lines(1);
    const memberName = faker.internet.userName();

    it('addButton generates button given link and text', () => {
      const link = 'mylink';
      const text = MAIL.GREETINGS;

      const mail = new MailBuilder({
        subject: { text: MAIL.SIGN_UP_TITLE },
      })
        .addButton(text, link)
        .build();

      expect(mail.html).toContain(link);
      expect(mail.html).toContain(enTranslations.GREETINGS);
      expect(mail.text).toContain(link);
    });

    it('addText generates text paragraph', () => {
      const text = MAIL.GREETINGS;

      const mail = new MailBuilder({
        subject: { text: MAIL.SIGN_UP_TITLE },
      })
        .addText(text)
        .build();

      expect(mail.text).toContain(enTranslations.GREETINGS);
      expect(mail.html).toContain(enTranslations.GREETINGS);
    });

    it('builds mail', async () => {
      const mail = new MailBuilder({
        subject: {
          text: MAIL.MEMBERSHIP_REQUEST_TITLE,
          translationVariables: { itemName, memberName },
        },
        lang,
      })
        .addText(MAIL.MEMBERSHIP_REQUEST_TEXT, { itemName, memberName })
        .addButton(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, { itemName })
        .build();

      await mailerService.send(mail, email);

      expect(mockSendEmail).toHaveBeenCalledWith(
        expect.stringContaining(memberName),
        email,
        expect.stringContaining(link),
        expect.stringContaining(link),
        expect.stringContaining('Graasp'),
        expect.anything(),
      );
    });

    it('translation escapes special characters in text, but not in subject', async () => {
      const itemName = 'very Cool Item name>';
      const memberName = 'Member007';

      const mail = new MailBuilder({
        subject: {
          text: MAIL.MEMBERSHIP_REQUEST_TITLE,
          translationVariables: { itemName, memberName },
        },
        lang: lang,
      })
        .addText(MAIL.MEMBERSHIP_REQUEST_TEXT, { itemName, memberName })
        .addButton(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, { itemName })
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
        subject: {
          text: MAIL.MEMBERSHIP_REQUEST_TITLE,
          translationVariables: { itemName, memberName },
        },
      })
        .addText(MAIL.MEMBERSHIP_REQUEST_TEXT, { itemName, memberName })
        .addButton(MAIL.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, { itemName })
        .addUserAgreement()
        .addIgnoreEmailIfNotRequestedNotice()
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
