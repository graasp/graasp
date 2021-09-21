import fastify from 'fastify';
import registerAppPlugins from '../src/app';

const fastifyInstance = fastify({});
registerAppPlugins(fastifyInstance);

describe('Items API', () => {
  afterAll(() => {
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.
    fastifyInstance.close();
  });

  test('GET /itemssss should return 404', async () => {
    const { statusCode } = await fastifyInstance.inject({ method: 'GET', url: '/itemssss' });
    expect(statusCode).toBe(404);
  });

  test('GET /items w/o multiple &id=<> parameters should return 400', async () => {
    const { statusCode } = await fastifyInstance.inject({ method: 'GET', url: '/items' });
    expect(statusCode).toBe(400);
  });

  test('GET /items/<fake-id> w/o user should return 401', async () => {
    const { statusCode } = await fastifyInstance.inject({
      method: 'GET',
      url: '/items/bec986c2-37f5-4cfd-b168-5a23a47b69a3',
      headers: {},
    });
    expect(statusCode).toBe(401);
  });
});
