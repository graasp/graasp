import { PassportUser } from 'fastify';

export type RoleStrategy = {
  test: (user?: PassportUser) => boolean;
  error?: new () => Error;
};
