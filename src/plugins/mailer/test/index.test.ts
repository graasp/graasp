import { FastifyInstance } from 'fastify';

import { SUCCESS_MESSAGES } from '@graasp/translations';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { MailerService } from '../service';

describe('Mailer', () => {
  let app: FastifyInstance;
  let mailerService: MailerService;

  beforeAll(async () => {
    ({ app } = await build());
    mailerService = resolveDependency(MailerService);
  });

  afterAll(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    app.close();
  });

  describe('buildButton', () => {
    it('generates button given link and text', () => {
      const link = 'mylink';
      const text = 'mytext';
      const button = mailerService.buildButton(link, text);
      expect(button).toContain(link);
      expect(button).toContain(text);
    });
  });

  describe('buildText', () => {
    it('generates text paragraph', () => {
      const text = 'mytext';
      const result = mailerService.buildText(text);
      expect(result).toContain(text);
    });
  });

  describe('translate', () => {
    it('generates button given link and text', () => {
      const translate = mailerService.translate('fr');
      expect(translate(SUCCESS_MESSAGES.COPY_ITEM).length).toBeGreaterThan(1);
    });
  });
});
