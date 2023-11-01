export interface GPTChoice {
  finish_reason: string | null;
  message: {
    content: unknown;
  };
}
