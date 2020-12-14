import fastifyServerInstance from '../src/app';

describe('Items API', () => {
  afterAll(() => {
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.
    fastifyServerInstance.close();
  });

  test('GET /itemssss should return 404', async () => {
    const { statusCode } =
      await fastifyServerInstance.inject({ method: 'GET', url: '/itemssss' });
    expect(statusCode).toBe(404);
  });

  test('GET /items w/o multiple &id=<> parameters should return 400', async () => {
    const { statusCode } =
      await fastifyServerInstance.inject({ method: 'GET', url: '/items' });
    expect(statusCode).toBe(400);
  });

  test('GET /items/<fake-id> w/o user should return 401', async () => {
    const { statusCode } =
      await fastifyServerInstance.inject({
        method: 'GET',
        url: '/items/bec986c2-37f5-4cfd-b168-5a23a47b69a3',
        headers: { }
      });
    expect(statusCode).toBe(401);
  });
});
