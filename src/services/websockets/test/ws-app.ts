import { FastifyInstance } from 'fastify';

import { CompleteMember } from '@graasp/sdk';

import build from '../../../../test/app';

const MAX_PORT = 65535;
const MIN_PORT = 1025;

async function listenOnRandomPort(app: FastifyInstance): Promise<string> {
  try {
    return await app.listen({
      port: Math.floor(Math.random() * (MAX_PORT - MIN_PORT)) + MIN_PORT,
      host: '0.0.0.0',
    });
  } catch (error) {
    if (error.code === 'EADDRINUSE') {
      return listenOnRandomPort(app);
    }
    throw error;
  }
}

export async function setupWsApp({ member }: { member?: CompleteMember | null } = {}) {
  const { app, actor } = await build(member ? { member } : undefined);
  await app.ready();
  const address = await listenOnRandomPort(app);
  return { app, actor, address };
}
