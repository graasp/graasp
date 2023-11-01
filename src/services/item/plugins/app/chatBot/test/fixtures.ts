import { ChatBotMessage } from '@graasp/sdk';

import * as OpenAICompletion from '../openAICompletion';

export const DOCKER_MOCKED_RESPONSE =
  'Docker is a platform for developing, shipping, and running applications in lightweight, isolated containers that provide consistency and portability across different environments.';
export const DOCKER_MOCKED_BODY: ChatBotMessage[] = [
  {
    role: 'system',
    content: 'You are a docker expert',
  },
  {
    role: 'assistant',
    content: 'Welcome ! How can I help you with Docker ?',
  },
  {
    role: 'user',
    content: 'What is Docker ?',
  },
];

export const copyArray = (arr: Array<unknown>) => JSON.parse(JSON.stringify(arr));

async function responseFactory(finish_reason: string | null, content?: string) {
  return {
    choices: [
      {
        finish_reason: finish_reason,
        message: { content: content },
      },
    ],
  };
}

export async function mockResponse(finish_reason: string | null, content?: string) {
  jest
    .spyOn(OpenAICompletion, 'openAICompletion')
    .mockImplementation(() => responseFactory(finish_reason, content));
}
