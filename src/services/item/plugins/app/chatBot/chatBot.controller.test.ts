import { StatusCodes } from 'http-status-codes';

import { FastifyInstance } from 'fastify';

import { GPTVersion, HttpMethod } from '@graasp/sdk';

import build, { clearDatabase } from '../../../../../../test/app.js';
import { APP_ITEMS_PREFIX } from '../../../../../utils/config.js';
import {
  OpenAILengthError,
  OpenAITimeOutError,
  OpenAIUnknownStopError,
} from '../../../../../utils/errors.js';
import { saveMember } from '../../../../member/test/fixtures/members.js';
import { AppTestUtils } from '../test/fixtures.js';
import { FinishReason } from './chatBot.types.js';
import { DOCKER_MOCKED_BODY, DOCKER_MOCKED_RESPONSE, mockResponse } from './test/fixtures.js';

const testUtils = new AppTestUtils();

// Indicate that the module openAICompletion will be mocked.
// This allow to mock the response of OpenAI only.
jest.mock('../openAICompletion');

function expectException(response, ex) {
  expect(response.json().code).toBe(ex.code);
  expect(response.json().message).toBe(ex.message);
}

describe('Chat Bot Tests', () => {
  let app: FastifyInstance;
  let actor;
  let item, token;
  const CHAT_PATH = 'chat-bot';

  afterEach(async () => {
    jest.clearAllMocks();
    await clearDatabase(app.db);
    actor = null;
    item = null;
    token = null;
    app.close();
  });

  describe('POST /:itemId/chat-bot', () => {
    describe('Sign Out', () => {
      beforeEach(async () => {
        ({ app } = await build({ member: null }));
        const member = await saveMember();

        ({ item, token } = await testUtils.setUp(app, actor, member));
      });

      it('Unauthorized if post chat message without member and token', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          payload: DOCKER_MOCKED_BODY,
        });
        expect(response.statusCode).toEqual(StatusCodes.UNAUTHORIZED);
      });
    });

    describe('Test Finish Reasons', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, token } = await testUtils.setUp(app, actor, actor));
      });

      // disabled for now as this does not seem like it could happen
      it.skip('Time out', async () => {
        mockResponse(FinishReason.NULL, DOCKER_MOCKED_RESPONSE);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });

        expectException(response, new OpenAITimeOutError());
      });

      it('Max chars', async () => {
        mockResponse(FinishReason.LENGTH, DOCKER_MOCKED_RESPONSE);

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
        const reason = 'What for a reason ?';
        mockResponse(reason, DOCKER_MOCKED_RESPONSE);

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
        ({ app, actor } = await build());
        ({ item, token } = await testUtils.setUp(app, actor, actor));
        mockResponse(FinishReason.STOP, DOCKER_MOCKED_RESPONSE);
      });

      it('Success post chat with valid body and authorized member', async () => {
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
        const gptVersion = GPTVersion.GPT_4;
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

      it('Bad request if post chat with invalid temperature', async () => {
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
        const INVALID_ARRAY = copyArray(DOCKER_MOCKED_BODY);
        INVALID_ARRAY[0].role = 'invalid';

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
    describe('Try access as unauthorized app', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        const member = await saveMember();
        ({ item, token } = await testUtils.setUpForbidden(app, actor, member));
        mockResponse(FinishReason.STOP);
      });

      it('Forbidden if Post chat on a different app using authorized user', async () => {
        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });

    describe('Try access as unauthorized item', () => {
      beforeEach(async () => {
        ({ app, actor } = await build());
        ({ item, token } = await testUtils.setUp(app, actor, actor));
        mockResponse(FinishReason.STOP);
      });

      it('Forbidden if Post chat on a different item using the same app', async () => {
        const { token: token2 } = await testUtils.setUp(app, actor, actor);

        const response = await app.inject({
          method: HttpMethod.Post,
          url: `${APP_ITEMS_PREFIX}/${item.id}/${CHAT_PATH}`,
          headers: {
            Authorization: `Bearer ${token2}`,
          },
          payload: DOCKER_MOCKED_BODY,
        });

        expect(response.statusCode).toEqual(StatusCodes.FORBIDDEN);
      });
    });
  });
});
