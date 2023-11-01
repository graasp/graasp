import { ChatBotMessage } from '@graasp/sdk';

import {
  OpenAIBaseError,
  OpenAILengthError,
  OpenAIQuotaError,
  OpenAITimeOutError,
  OpenAIUnknownStopError,
} from '../../../../../utils/errors';
import { FinishReason } from './interfaces/finishReason';
import { GPTChoice } from './interfaces/gptChoice';
import { GPTVersion } from './interfaces/gptVersion';
import { openAICompletion } from './openAICompletion';

export const fetchOpenAI = async (body: Array<ChatBotMessage>, gptVersion?: GPTVersion) => {
  try {
    const completion = await openAICompletion(body, gptVersion);
    const choice = completion.choices[0];

    return computeResult(choice, gptVersion);
  } catch (e) {
    if (e instanceof OpenAIBaseError) {
      throw e;
      // if the catched error is OpenAI insufficient quota
      // throw a new OpenAIQuota error
    } else if (e.status === 429) {
      throw new OpenAIQuotaError();
    }

    // handle unexpected errors (like billing expired)
    throw new OpenAIBaseError({ message: e.message });
  }
};

function computeResult(choice: GPTChoice, gptVersion?: GPTVersion) {
  switch (`${choice.finish_reason}`) {
    case FinishReason.LENGTH:
      throw new OpenAILengthError();
    case FinishReason.NULL:
      throw new OpenAITimeOutError();
    case FinishReason.STOP:
      return { completion: choice.message.content, model: gptVersion };
    default:
      throw new OpenAIUnknownStopError(`${choice.finish_reason}`);
  }
}
