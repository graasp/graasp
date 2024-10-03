import { TFunction } from 'i18next';

import { DEFAULT_LANG } from '@graasp/translations';

import { GRAASP_LANDING_PAGE_ORIGIN } from '../../utils/constants';
import i18next from './i18n';
import { MAIL } from './langs/constants';
import { Mail } from './service';

type CssStyles = { [key: string]: string };

export class MailBuilder {
  private subject: string;
  private plainText = '';
  private htmlText = '';
  private buttonText: string;
  private translationVariables: { [key: string]: string };
  private language: string = DEFAULT_LANG;

  private t: TFunction;

  constructor({
    subject,
    translationVariables,
    lang,
  }: {
    subject: string;
    translationVariables: { [key: string]: string };
    lang?: string;
  }) {
    this.subject = subject;
    this.translationVariables = translationVariables;

    if (lang) {
      this.language = lang;
    }

    i18next.changeLanguage(this.language);
    this.t = i18next.t;
  }

  public addText(stringId: string): MailBuilder {
    const unescapedText = this.t(stringId, {
      ...this.translationVariables,
      interpolation: { escapeValue: false },
    });
    this.plainText += `\n${unescapedText}\n`;

    const escapedText = this.t(stringId, this.translationVariables);
    this.htmlText += this.buildText(escapedText);

    return this;
  }

  public addButton(buttonText: string, callToActionLink: string): MailBuilder {
    this.plainText += `\n${callToActionLink}\n`;

    this.htmlText += this.buildButton(
      callToActionLink,
      this.t(buttonText, this.translationVariables),
    );

    // keep this text for user agreement
    this.buttonText = buttonText;

    return this;
  }

  public includeUserAgreement(): MailBuilder {
    const unescapedSignUpButtonText = this.t(this.buttonText, {
      ...this.translationVariables,
      interpolation: { escapeValue: false },
    });
    const unescapedText = this.t(MAIL.USER_AGREEMENTS_MAIL_TEXT, {
      signUpButtonText: unescapedSignUpButtonText,
      graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
      interpolation: { escapeValue: false },
    });
    this.plainText += `\n${unescapedText}\n`;

    const escapedText = this.t(MAIL.USER_AGREEMENTS_MAIL_TEXT, {
      signUpButtonText: this.t(this.buttonText, this.translationVariables),
      graaspLandingPageOrigin: GRAASP_LANDING_PAGE_ORIGIN,
    });
    this.htmlText += this.buildText(
      escapedText,
      // Add margin top of -15px to remove 15px margin bottom of the button.
      { 'text-align': 'center', 'font-size': '10px', 'margin-top': '-15px' },
    );

    return this;
  }

  public signUpNotRequested(): MailBuilder {
    const translatedText = this.t(MAIL.SIGN_UP_NOT_REQUESTED);

    this.plainText += `\n${translatedText}\n`;
    this.htmlText += this.buildText(this.t(MAIL.SIGN_UP_NOT_REQUESTED));

    return this;
  }

  public build(): Mail {
    const emailSubject = this.t(this.subject, {
      ...this.translationVariables,
      interpolation: { escapeValue: false },
    });

    const footer = this.buildFooter();

    return {
      subject: emailSubject,
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
            ${this.t('FOOTER')}.
            <br />
            <span class="apple-link">Graasp Association, Valais, Switzerland</span>
          </td>
        </tr>
        <tr>
          <td class="content-block powered-by">
            ${this.t('POWERED_BY')}
          </td>
        </tr>
      </table>
    `;
  }

  private buildButton(link: string, text: string): string {
    return `
      <table role="presentation" border="0" cellpadding="0" cellspacing="0" class="btn btn-primary">
        <tbody>
          <tr>
            <td align="center">
              <table role="presentation" border="0" cellpadding="0" cellspacing="0">
                <tbody>
                  <tr>
                    <td><a href="${link}" target="_blank">${text}</a></td>
                  </tr>
                </tbody>
              </table>
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
