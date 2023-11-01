import { GPTChoice } from './gptChoice';

export interface GPTCompletion {
  choices: Array<GPTChoice>;
}
