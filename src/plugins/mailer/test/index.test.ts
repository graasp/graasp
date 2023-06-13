import { SUCCESS_MESSAGES } from '@graasp/translations';

import build, { clearDatabase } from '../../../../test/app';

// mock datasource
jest.mock('../../../plugins/datasource');

describe('Mailer', () => {
  let app;

  beforeAll(async () => {
    ({ app } = await build());
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
      const button = app.mailer.buildButton(link, text);
      expect(button).toContain(link);
      expect(button).toContain(text);
    });
  });

  describe('buildText', () => {
    it('generates text paragraph', () => {
      const text = 'mytext';
      const result = app.mailer.buildText(text);
      expect(result).toContain(text);
    });
  });

  describe('translate', () => {
    it('generates button given link and text', () => {
      const translate = app.mailer.translate('fr');
      expect(translate(SUCCESS_MESSAGES.COPY_ITEM).length).toBeGreaterThan(1);
    });
  });
});
