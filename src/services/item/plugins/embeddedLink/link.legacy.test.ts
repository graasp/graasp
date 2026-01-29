import { eq } from 'drizzle-orm';
import { ReasonPhrases, StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';

import type { FastifyInstance } from 'fastify';

import { HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../test/app';
import { ItemFactory } from '../../../../../test/factories/item.factory';
import { seedFromJson } from '../../../../../test/mocks/seed';
import { db } from '../../../../drizzle/db';
import { itemsRawTable } from '../../../../drizzle/schema';
import { assertIsDefined } from '../../../../utils/assertions';

jest.mock('node-fetch');

const iframelyMeta = {
  title: 'title',
  description: 'description',
};

const iframelyResult = {
  meta: iframelyMeta,
  html: 'html',
  icons: [],
  thumbnails: [],
};

describe('Link Item tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  beforeEach(() => {
    (fetch as jest.MockedFunction<typeof fetch>).mockImplementation(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { json: async () => iframelyResult } as any;
    });
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  // cannot update a link
  describe('PATCH /items/:id', () => {
    it('Throws if signed out', async () => {
      const {
        items: [item],
      } = await seedFromJson({ items: [ItemFactory({ type: 'embeddedLink' })] });

      const response = await app.inject({
        method: HttpMethod.Patch,
        url: `/api/items/${item.id}`,
        payload: { name: 'new name' },
      });

      expect(response.statusCode).toBe(StatusCodes.UNAUTHORIZED);
    });

    describe('Signed In', () => {
      it('Allow to edit link url', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              ...ItemFactory({ name: 'link item', type: 'embeddedLink' }),
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            ['embeddedLink']: {
              url: 'https://newurl.com',
            },
          },
          settings: {
            someSetting: 'value',
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.OK);
        expect(response.statusCode).toBe(StatusCodes.OK);
        // check db update
        const itemInDb = await db.query.itemsRawTable.findFirst({
          where: eq(itemsRawTable.id, item.id),
        });
        assertIsDefined(itemInDb);
        expect(itemInDb.name).toEqual(payload.name);
      });

      it('Disallow editing html in extra', async () => {
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [ItemFactory({ name: 'link item', type: 'embeddedLink' })],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);

        const payload = {
          name: 'new name',
          extra: {
            ['embeddedLink']: {
              html: '<script>alert("Hello !")</script>',
            },
          },
        };

        const response = await app.inject({
          method: HttpMethod.Patch,
          url: `/api/items/${item.id}`,
          payload,
        });

        expect(response.statusMessage).toEqual(ReasonPhrases.BAD_REQUEST);
        expect(response.statusCode).toBe(StatusCodes.BAD_REQUEST);
      });
    });
  });
});
