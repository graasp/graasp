import type { TFunction } from 'i18next';

import { DEFAULT_LANG } from '@graasp/translations';

import i18next from '../../i18n';
import { TRANSLATIONS } from '../../langs/constants';
import { GRAASP_LANDING_PAGE_ORIGIN } from '../../utils/constants';
import { type Mail } from './mailer.service';

type CssStyles = { [key: string]: string };

export class MailBuilder {
  /**
   * The subject of the e-mail. Note that the interpolation in the subject translation string will not be escaped.
   */
  private subject: string;
  /**
   * The contents of the e-mail in plaintext. Note that the interpolation in the subject translation string will not be escaped.
   */
  private plainText = '';
  /**
   * The HTML contents of the e-mail. Note that the interpolation in the subject translation string will be escaped for security reasons.
   */
  private htmlText = '';
  /**
   * The language of the e-mail.
   */
  private language: string = DEFAULT_LANG;

  private translate: TFunction;

  constructor({
    subject,
    lang,
  }: {
    subject: {
      text: (typeof TRANSLATIONS)[keyof typeof TRANSLATIONS];
      translationVariables?: { [key: string]: string };
    };
    lang?: string;
  }) {
    if (lang) {
      this.language = lang;
    }

    i18next.changeLanguage(this.language);
    this.translate = i18next.t;

    this.subject = this.translate(subject.text, {
      ...subject.translationVariables,
      interpolation: { escapeValue: false },
    });
  }

  public addText(
    mailTextId: (typeof TRANSLATIONS)[keyof typeof TRANSLATIONS],
    translationVariables?: { [key: string]: string },
  ): MailBuilder {
    const unescapedText = this.translate(mailTextId, {
      ...translationVariables,
      interpolation: { escapeValue: false },
    });
    this.plainText += `\n${unescapedText}\n`;

    const escapedText = this.translate(mailTextId, translationVariables);
    this.htmlText += this.buildText(escapedText);

    return this;
  }

  public addButton(
    mailButtonTextId: (typeof TRANSLATIONS)[keyof typeof TRANSLATIONS],
    callToActionLink: string,
    translationVariables?: { [key: string]: string },
  ): MailBuilder {
    this.plainText += `\n${callToActionLink}\n`;

    this.htmlText += this.buildButton(
      callToActionLink,
      this.translate(mailButtonTextId, translationVariables),
    );

    return this;
  }

  /**
   * This function add the user agreement usually placed at the end of the e-mail.
   */
  public addUserAgreement(): MailBuilder {
    const unescapedText = this.translate(TRANSLATIONS.USER_AGREEMENTS_MAIL_TEXT, {
      graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
      interpolation: { escapeValue: false },
    });
    this.plainText += `\n${unescapedText}\n`;

    const escapedText = this.translate(TRANSLATIONS.USER_AGREEMENTS_MAIL_TEXT, {
      graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
    });
    this.htmlText += this.buildText(
      escapedText,
      // Add margin top of -15px to remove 15px margin bottom of the button.
      { 'text-align': 'center', 'font-size': '10px', 'margin-top': '-15px' },
    );

    return this;
  }

  public addIgnoreEmailIfNotRequestedNotice(): MailBuilder {
    return this.addText(TRANSLATIONS.IGNORE_EMAIL_IF_NOT_REQUESTED);
  }

  public build(): Mail {
    const footer = this.buildFooter();

    return {
      subject: this.subject,
      text: this.plainText,
      html: this.htmlText,
      footer: footer,
    };
  }

  private buildText(text: string, styles?: CssStyles): string {
    return `<p ${this.buildStyles(styles)}>${text}</p>`;
  }

  private buildFooter(): string {
    return `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0">
        <tr>
          <td class="content-block">
            ${this.translate('FOOTER')}.
            <br />
            <span class="apple-link">Graasp Association, Valais, Switzerland</span>
          </td>
        </tr>
        <tr>
          <td class="content-block powered-by">
            ${this.translate('POWERED_BY')}
          </td>
        </tr>
      </table>
    `;
  }

  private buildButton(link: string, text: string): string {
    return `
      <table role="presentation">
        <tbody>
          <tr>
            <td align="center" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
              <a href="${link}" target="_blank">${text}</a>
            </td>
          </tr>
          <tr>
            <td class="btn-readable-link">
              <a href="${link}" target="_blank" >${link}</a>
            </td>
          </tr>
        </tbody>
      </table>
    `;
  }

  private buildStyles(styles?: CssStyles): string {
    if (styles) {
      const strStyles = Object.keys(styles).map((key: string) => `${key}: ${styles[key]}`);
      return `style="${strStyles.join('; ')}"`;
    }
    return '';
  }
}
