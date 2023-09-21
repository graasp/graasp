import { FastifyInstance } from 'fastify';

import build from '../../../../test/app';
import { Member } from '../../member/entities/member';

const MAX_PORT = 65535;
const MIN_PORT = 1025;

function listenOnRandomPort(app: FastifyInstance): Promise<string> {
  try {
    return app.listen({
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

export async function setupWsApp({ member }: { member?: Member | null } = {}) {
  const { app, actor } = await build(member ? { member } : undefined);
  await app.ready();
  const address = await listenOnRandomPort(app);
  return { app, actor, address };
}
