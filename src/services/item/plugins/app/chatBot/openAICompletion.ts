import OpenAI from 'openai';

import { ChatBotMessage } from '@graasp/sdk';

import { OPENAI_GPT_VERSION } from '../../../../../utils/config';
import { OpenAIBadVersion } from '../../../../../utils/errors';
import { GPTCompletion } from './interfaces/gptCompletion';
import { GPTVersion } from './interfaces/gptVersion';

export const openAICompletion = async (body: Array<ChatBotMessage>, gptVersion?: GPTVersion) => {
  validateGPTVersion(gptVersion);
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    organization: process.env.OPENAI_ORG_ID,
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
