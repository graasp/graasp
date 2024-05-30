import { PassportUser } from 'fastify';

export interface StrictVerifiedCallback {
  // Info parameter type can be specified if needed.
  (error: Error | null, user: PassportUser | false, info?: never): void;
}
