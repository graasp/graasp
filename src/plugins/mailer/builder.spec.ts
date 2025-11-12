import { faker } from '@faker-js/faker';
import { describe, expect, it } from 'vitest';

import { TRANSLATIONS } from '../../langs/constants';
import enTranslations from '../../langs/en.json';
import { MailBuilder } from './builder';

describe('Mailer', () => {
  describe('MailBuilder', () => {
    const lang = 'fr';
    const link = faker.internet.url();
    const itemName = faker.lorem.lines(1);
    const memberName = faker.internet.username();

    it('addButton generates button given link and text', () => {
      const link = 'mylink';
      const text = TRANSLATIONS.GREETINGS;

      const mail = new MailBuilder({
        subject: { text: TRANSLATIONS.SIGN_UP_TITLE },
      })
        .addButton(text, link)
        .build();

      expect(mail.html).toContain(link);
      expect(mail.html).toContain(enTranslations.GREETINGS);
      expect(mail.text).toContain(link);
    });

    it('addText generates text paragraph', () => {
      const text = TRANSLATIONS.GREETINGS;

      const mail = new MailBuilder({
        subject: { text: TRANSLATIONS.SIGN_UP_TITLE },
      })
        .addText(text)
        .build();

      expect(mail.text).toContain(enTranslations.GREETINGS);
      expect(mail.html).toContain(enTranslations.GREETINGS);
    });

    it('translation escapes special characters in text, but not in subject', async () => {
      const itemName = 'very Cool Item name>';
      const memberName = 'Member007';

      const mail = new MailBuilder({
        subject: {
          text: TRANSLATIONS.MEMBERSHIP_REQUEST_TITLE,
          translationVariables: { itemName, memberName },
        },
        lang: lang,
      })
        .addText(TRANSLATIONS.MEMBERSHIP_REQUEST_TEXT, { itemName, memberName })
        .addButton(TRANSLATIONS.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, { itemName })
        .build();

      // expect item name in subject to not be escaped
      expect(mail.subject).toContain(itemName);
      // expect item name in body to be escaped by the translations
      expect(mail.html).toContain(itemName.slice(0, -1).concat('&gt;'));
      expect(mail.text).toContain(link);
    });

    it('user agreement and sign up not requested blocks are generated', async () => {
      const mail = new MailBuilder({
        subject: {
          text: TRANSLATIONS.MEMBERSHIP_REQUEST_TITLE,
          translationVariables: { itemName, memberName },
        },
      })
        .addText(TRANSLATIONS.MEMBERSHIP_REQUEST_TEXT, { itemName, memberName })
        .addButton(TRANSLATIONS.MEMBERSHIP_REQUEST_BUTTON_TEXT, link, { itemName })
        .addUserAgreement()
        .addIgnoreEmailIfNotRequestedNotice()
        .build();

      expect(mail.subject).toContain(memberName);
      expect(mail.text).toContain(link);
      expect(mail.html).toContain(
        'If you are not the author of this action, you can just ignore this email',
      );
      expect(mail.html).toContain('terms of service');
      expect(mail.html).toContain('privacy policy');
      expect(mail.footer).toContain('Graasp');
    });
  });
});
