import fastifyServerInstance from '../src/app';

describe('Items API', () => {
  afterAll(() => {
    // At the end of your tests it is highly recommended to call `.close()`
    // to ensure that all connections to external services get closed.
    fastifyServerInstance.close();
  });

  test('GET /itemssss should return 401', async () => {
    const { statusCode } =
      await fastifyServerInstance.inject({ method: 'GET', url: '/itemssss' });
    expect(statusCode).toBe(401);
  });

  test('GET /items w/o user should return 401', async () => {
    const { statusCode } =
      await fastifyServerInstance.inject({ method: 'GET', url: '/items' });
    expect(statusCode).toBe(401);
  });

  test('GET /items w/ user should return 404', async () => {
    const { statusCode } =
      await fastifyServerInstance.inject({
        method: 'GET',
        url: '/items',
        headers: {
          // TODO: this matches a fake user in a local dev env.
          // It's just an example test - to be changed.
          Authorization: 'Basic VTI6bm90dXNlZG5vdw=='
        }
      });
    expect(statusCode).toBe(404);
  });
});
