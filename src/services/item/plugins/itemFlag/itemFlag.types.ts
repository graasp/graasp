import { UnionOfConst } from '@graasp/sdk';

export const FlagType = {
  InappropriateContent: 'inappropriate-content',
  HateSpeech: 'hate-speech',
  FraudPlagiarism: 'fraud-plagiarism',
  Spam: 'spam',
  TargetedHarassment: 'targeted-harassment',
  FalseInformation: 'false-information',
} as const;
export type FlagOptionsType = UnionOfConst<typeof FlagType>;
