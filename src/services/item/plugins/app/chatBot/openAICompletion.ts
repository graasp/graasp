import { OpenAI } from 'openai';

import { type ChatBotMessage, GPTVersion, type GPTVersionType } from '@graasp/sdk';

import { OPENAI_API_KEY, OPENAI_ORG_ID } from '../../../../../utils/config';
import { OpenAIBadVersion } from '../../../../../utils/errors';

export const openAICompletion = async (
  body: Array<ChatBotMessage>,
  gptVersion: GPTVersionType,
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

export function validateGPTVersion(gptVersion?: GPTVersionType) {
  if (gptVersion && !Object.values(GPTVersion).includes(gptVersion as GPTVersionType)) {
    throw new OpenAIBadVersion(gptVersion, `${Object.values(GPTVersion)}`);
  }
}
