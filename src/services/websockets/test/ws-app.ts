import type { FastifyInstance } from 'fastify';

import build from '../../../../test/app';
import { HOST_LISTEN_ADDRESS } from '../../../utils/config';

const MAX_PORT = 65535;
const MIN_PORT = 1025;

async function listenOnRandomPort(app: FastifyInstance): Promise<string> {
  try {
    return await app.listen({
      port: Math.floor(Math.random() * (MAX_PORT - MIN_PORT)) + MIN_PORT,
      host: HOST_LISTEN_ADDRESS,
    });
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'EADDRINUSE'
    ) {
      return listenOnRandomPort(app);
    }
    throw error;
  }
}

export async function setupWsApp() {
  const { app } = await build();
  await app.ready();
  const address = await listenOnRandomPort(app);
  return { app, address };
}
