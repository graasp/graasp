import { createError } from '@fastify/error';

export const FlagNotFound = createError('GIFERR003', 'Flag not found', 404);
