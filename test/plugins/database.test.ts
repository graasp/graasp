import fastify from 'fastify';
import fp from 'fastify-plugin';

import databasePlugin from '../../src/plugins/database';

describe('Database plugin interceptors', () => {
  it('Registers all interceptors successfully', async () => {
    const app = fastify();

    await app.register(fp(databasePlugin), {
      uri: 'pg://foo:bar@hello/world',
      readReplicaUris: ['pg://foo:bar@replica/world'],
      logs: true,
    });

    expect(app.db.pool).toBeDefined();
    expect(app.db.pool.configuration.interceptors.length).toBe(2);
  });

  it('Registers only logs interceptor successfully', async () => {
    const app = fastify();

    await app.register(fp(databasePlugin), {
      uri: 'pg://foo:bar@hello/world',
      logs: true,
    });

    expect(app.db.pool).toBeDefined();
    expect(app.db.pool.configuration.interceptors.length).toBe(1);
  });

  it('Registers only read replicas interceptor successfully', async () => {
    const app = fastify();

    await app.register(fp(databasePlugin), {
      uri: 'pg://foo:bar@hello/world',
      readReplicaUris: ['pg://foo:bar@replica/world'],
      logs: false,
    });

    expect(app.db.pool).toBeDefined();
    expect(app.db.pool.configuration.interceptors.length).toBe(1);
  });
});
