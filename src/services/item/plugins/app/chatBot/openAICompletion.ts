import { OpenAI } from 'openai';

import { ChatBotMessage, GPTVersion } from '@graasp/sdk';

import {
  OPENAI_API_KEY,
  OPENAI_MAX_TEMP,
  OPENAI_MIN_TEMP,
  OPENAI_ORG_ID,
} from '../../../../../utils/config';
import { OpenAIBadTemperature, OpenAIBadVersion } from '../../../../../utils/errors';

export const openAICompletion = async (
  body: Array<ChatBotMessage>,
  gptVersion: GPTVersion,
  temperature?: number,
) => {
  validateGPTVersion(gptVersion);
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    organization: OPENAI_ORG_ID,
  });

  const completion = await openai.chat.completions.create({
    messages: body,
    model: gptVersion,
    temperature,
  });

  return completion;
};

export function validateTemperature(temperature?: number) {
  if (temperature) {
    if (temperature < OPENAI_MIN_TEMP || temperature > OPENAI_MAX_TEMP) {
      throw new OpenAIBadTemperature(temperature, OPENAI_MAX_TEMP, OPENAI_MIN_TEMP);
    }
  }
}

export function validateGPTVersion(gptVersion?: GPTVersion) {
  if (gptVersion && !Object.values(GPTVersion).includes(gptVersion as GPTVersion)) {
    throw new OpenAIBadVersion(gptVersion, `${Object.values(GPTVersion)}`);
  }
}
