import { FastifyInstance } from 'fastify';

import { SUCCESS_MESSAGES } from '@graasp/translations';

import build, { clearDatabase } from '../../../../test/app';
import { resolveDependency } from '../../../di/utils';
import { MailerService } from '../service';

// mock datasource
jest.mock('../../../plugins/datasource');

describe('Mailer', () => {
  let app: FastifyInstance;
  let mailer: MailerService;

  beforeAll(async () => {
    ({ app } = await build());
    mailer = resolveDependency(MailerService);
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
      const button = mailer.buildButton(link, text);
      expect(button).toContain(link);
      expect(button).toContain(text);
    });
  });

  describe('buildText', () => {
    it('generates text paragraph', () => {
      const text = 'mytext';
      const result = mailer.buildText(text);
      expect(result).toContain(text);
    });
  });

  describe('translate', () => {
    it('generates button given link and text', () => {
      const translate = mailer.translate('fr');
      expect(translate(SUCCESS_MESSAGES.COPY_ITEM).length).toBeGreaterThan(1);
    });
  });
});
