import OpenAI from 'openai';

import { ChatBotMessage } from '@graasp/sdk';

import { OPENAI_API_KEY, OPENAI_GPT_VERSION, OPENAI_ORG_ID } from '../../../../../utils/config';
import { OpenAIBadVersion } from '../../../../../utils/errors';
import { GPTCompletion } from './interfaces/gptCompletion';
import { GPTVersion } from './interfaces/gptVersion';

export const openAICompletion = async (body: Array<ChatBotMessage>, gptVersion?: GPTVersion) => {
  validateGPTVersion(gptVersion);
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY,
    organization: OPENAI_ORG_ID,
  });

  const completion: GPTCompletion = await openai.chat.completions.create({
    messages: body,
    model: gptVersion ?? OPENAI_GPT_VERSION,
  });

  return completion;
};

export function validateGPTVersion(gptVersion?: GPTVersion) {
  if (gptVersion && !Object.values(GPTVersion).includes(gptVersion as GPTVersion)) {
    throw new OpenAIBadVersion(gptVersion, `${Object.values(GPTVersion)}`);
  }
}
