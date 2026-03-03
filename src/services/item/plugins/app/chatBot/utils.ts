import type { ChatCompletion } from 'openai/resources/chat/index';

import { type ChatBotMessage, type GPTVersionType } from '@graasp/sdk';

import {
  OpenAIBaseError,
  OpenAILengthError,
  OpenAIQuotaError,
  OpenAIUnknownStopError,
} from '../../../../../utils/errors';
import { FinishReason } from './chatBot.types';
import { openAICompletion } from './openAICompletion';

export const fetchOpenAI = async (
  body: ChatBotMessage[],
  gptVersion: GPTVersionType,
  temperature: number,
) => {
  try {
    const completion = await openAICompletion(body, gptVersion, temperature);
    const choice = completion.choices[0];

    return computeResult(choice, gptVersion);
  } catch (e: unknown) {
    if (e instanceof OpenAIBaseError) {
      throw e;
    } else if (e !== null && typeof e === 'object') {
      if ('status' in e && e.status === 429) {
        // if the catched error is OpenAI insufficient quota
        // throw a new OpenAIQuota error
        throw new OpenAIQuotaError();
      } else if ('message' in e && typeof e.message === 'string') {
        // handle unexpected errors (like billing expired)
        throw new OpenAIBaseError({ message: e.message });
      }
    }
    throw new OpenAIBaseError({ message: String(e) });
  }
};

function computeResult(choice: ChatCompletion.Choice, gptVersion?: GPTVersionType) {
  const finishReason = choice.finish_reason;
  switch (finishReason) {
    case FinishReason.LENGTH:
      throw new OpenAILengthError();
    // todo: this does not look like it could match the type
    // case FinishReason.NULL:
    //   throw new OpenAITimeOutError();
    case FinishReason.STOP:
      return { completion: choice.message.content, model: gptVersion };
    default:
      throw new OpenAIUnknownStopError(finishReason);
  }
}
