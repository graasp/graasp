import { StatusCodes } from 'http-status-codes';

import type { FastifyInstance, LightMyRequestResponse } from 'fastify';

import { GPTVersion, HttpMethod } from '@graasp/sdk';

import build, {
  clearDatabase,
  mockAuthenticate,
  unmockAuthenticate,
} from '../../../../../../test/app';
import { seedFromJson } from '../../../../../../test/mocks/seed';
import { db } from '../../../../../drizzle/db';
import { assertIsDefined } from '../../../../../utils/assertions';
import { APP_ITEMS_PREFIX, OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { OpenAILengthError, OpenAIUnknownStopError } from '../../../../../utils/errors';
import { getAccessToken } from '../test/fixtures';
import { FinishReason } from './chatBot.types';
import {
  DOCKER_MOCKED_BODY,
  DOCKER_MOCKED_RESPONSE,
  copyArray,
  mockResponse,
} from './test/fixtures';

// Indicate that the module openAICompletion will be mocked.
// This allow to mock the response of OpenAI only.
jest.mock('./openAICompletion');

function expectException(response: LightMyRequestResponse, ex: { code: string; message: string }) {
  expect(response.json().code).toBe(ex.code);
  expect(response.json().message).toBe(ex.message);
}

const CHAT_PATH = 'chat-bot';

describe('Chat Bot Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    ({ app } = await build());
  });

  afterAll(async () => {
    await clearDatabase(db);
    app.close();
  });

  afterEach(async () => {
    jest.clearAllMocks();
    unmockAuthenticate();
  });

  describe('POST /:itemId/chat-bot', () => {
    describe('Sign Out', () => {
      it('Unauthorized if post chat message without member and token', async () => {
        const {
          items: [item],
        } = await seedFromJson({ actor: null, items: [{}] });
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Test Finish Reasons', () => {
      // disabled for now as this does not seem like it could happen
      // it.skip('Time out', async () => {
      //   mockResponse(FinishReason.NULL, DOCKER_MOCKED_RESPONSE);

      //   const response = await app.inject({
      //     method: HttpMethod.Post,
      //     url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
      //     headers: {
      //       Authorization: `Bearer ${token}`,
      //     },
      //     payload: DOCKER_MOCKED_BODY,
      //   });

      //   expectException(response, new OpenAITimeOutError());
      // });

      it('Max chars', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        mockResponse(FinishReason.LENGTH, DOCKER_MOCKED_RESPONSE);

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });

        expectException(response, new OpenAILengthError());
      });

      it('Unknown reason', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        const reason = 'What for a reason ?';
        mockResponse(reason, DOCKER_MOCKED_RESPONSE);

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });

        expectException(response, new OpenAIUnknownStopError(reason));
      });
    });

    describe('Sign In', () => {
      beforeEach(async () => {
        mockResponse(FinishReason.STOP, DOCKER_MOCKED_RESPONSE);
      });

      it('Success post chat with valid body and authorized member', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item],
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().completion).toBe(DOCKER_MOCKED_RESPONSE);
      });

      it('Success post chat with custom version', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const gptVersion = GPTVersion.GPT_5_MINI;
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}?gptVersion=${gptVersion}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().completion).toBe(DOCKER_MOCKED_RESPONSE);
        expect(response.json().model).toBe(gptVersion);
      });

      it('Success post chat with temperature', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        assertIsDefined(actor);
        mockAuthenticate(actor);
        const chosenApp = apps[0];

        const token = await getAccessToken(app, item, chosenApp);
        const temperature = 0.8;
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}?temperature=${temperature}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().completion).toBe(DOCKER_MOCKED_RESPONSE);
      });

      it('Bad request if post chat without body', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if post chat with invalid GPT version', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}?gptVersion=INVALID`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('OK if using accepted version but default to newer model', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}?gptVersion=gpt-4`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.OK);
        expect(response.json().model).toBe(OPENAI_GPT_VERSION);
      });

      it('Bad request if post chat with invalid temperature', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}?temperature=100`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if post chat with empty array body', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: [],
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if post chat with invalid array role', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        const INVALID_ARRAY = copyArray(DOCKER_MOCKED_BODY);
        INVALID_ARRAY[0].role = 'invalid';

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: INVALID_ARRAY,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Bad request if post chat with missing array attibutes', async () => {
        const INVALID_ARRAY = copyArray(DOCKER_MOCKED_BODY);
        INVALID_ARRAY[1] = { role: 'system' };

        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: INVALID_ARRAY,
        });
        expect(response.statusCode).toEqual(StatusCodes.BAD_REQUEST);
      });

      it('Not found if post chat with invalid item id', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          items: [item],
          actor,
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const token = await getAccessToken(app, item, chosenApp);
        const invalidId = '2891ae09-d790-4af1-a290-6eec6972496a';
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${invalidId}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.NOT_FOUND);
      });
    });

    describe('Try access as unauthorized item', () => {
      it('Forbidden if Post chat on a different item using the same app', async () => {
        const { apps } = await seedFromJson({ apps: [{}] });
        const {
          actor,
          items: [item, anotherItem],
        } = await seedFromJson({
          items: [
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
            {
              type: 'app',
              memberships: [{ account: 'actor' }],
            },
          ],
        });
        const chosenApp = apps[0];

        assertIsDefined(actor);
        mockAuthenticate(actor);
        const tokenForAnotherItem = await getAccessToken(app, anotherItem, chosenApp);

        mockResponse(FinishReason.STOP);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${tokenForAnotherItem}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });
  });
});
