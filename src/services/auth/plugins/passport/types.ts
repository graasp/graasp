import { PassportUser } from 'fastify';

// Info parameter type can be specified if needed.
export type StrictVerifiedCallback = (
  error: Error | null,
  user: PassportUser | false,
  info?: never,
) => void;

export type CustomStrategyOptions = {
  spreadException: boolean;
};
