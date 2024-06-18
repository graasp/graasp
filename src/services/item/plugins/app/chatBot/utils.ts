import { ChatCompletion } from 'openai/resources/chat/index.js';

import { ChatBotMessage, GPTVersion } from '@graasp/sdk';

import {
  OpenAIBaseError,
  OpenAILengthError,
  OpenAIQuotaError,
  OpenAIUnknownStopError,
} from '../../../../../utils/errors.js';
import { FinishReason } from './interfaces/finishReason.js';
import { openAICompletion } from './openAICompletion.js';

export const fetchOpenAI = async (body: ChatBotMessage[], gptVersion: GPTVersion) => {
  try {
    const completion = await openAICompletion(body, gptVersion);
    const choice = completion.choices[0];

    return computeResult(choice, gptVersion);
  } catch (e) {
    if (e instanceof OpenAIBaseError) {
      throw e;
    } else if (e.status === 429) {
      // if the catched error is OpenAI insufficient quota
      // throw a new OpenAIQuota error
      throw new OpenAIQuotaError();
    }

    // handle unexpected errors (like billing expired)
    throw new OpenAIBaseError({ message: e.message });
  }
};

function computeResult(choice: ChatCompletion.Choice, gptVersion?: GPTVersion) {
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
