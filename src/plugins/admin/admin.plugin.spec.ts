import nock from 'nock';
import supertest from 'supertest';
import type TestAgent from 'supertest/lib/agent';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FastifyInstance, fastify } from 'fastify';

import { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET } from '../../config/admin';
import { db } from '../../drizzle/db';
import { adminsTable } from '../../drizzle/schema';
import adminPlugin from './admin.plugin';

export function generateGithubId(min: number = 1000, max: number = 999999999): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

describe('GitHub OAuth', () => {
  let app: FastifyInstance;
  let agent: TestAgent;

  beforeEach(async () => {
    app = fastify();
    app.register(adminPlugin);
    await app.ready();
    agent = supertest.agent(app.server);
    nock.cleanAll();
  });

  afterEach(() => {
    nock.cleanAll();
  });

  it('should complete the normal OAuth flow', async () => {
    const githubId = generateGithubId();
    const githubIdString = githubId.toString();
    // Simulate GitHub callback with code
    let code = '';
    let redirectionURL = '';
    // Mock GitHub token exchange
    nock('https://github.com')
      .get('/login/oauth/authorize')
      .query((query) => {
        redirectionURL = query.redirect_uri?.toString() ?? '';
        return query.client_id === GITHUB_CLIENT_ID;
      })
      .reply(302, undefined, { Location: redirectionURL });

    // Mock GitHub token exchange
    nock('https://github.com')
      .post('/login/oauth/access_token', (body) => {
        code = body.code;
        return body.client_id === GITHUB_CLIENT_ID && body.client_secret === GITHUB_CLIENT_SECRET;
      })
      .reply(200, {
        access_token: 'mock-access-token',
        token_type: 'bearer',
        scope: 'user:email',
      });

    // Mock GitHub user API
    nock('https://api.github.com').get('/user').reply(200, {
      id: githubId,
      login: 'testuser',
    });

    // add an admin inside the database
    await db
      .insert(adminsTable)
      .values({ githubId: githubIdString, githubName: `testuser${githubId}` })
      .onConflictDoNothing();
    // User clicks the login link
    const res1 = await agent.get('/admin/auth/github').redirects(5);
    expect(res1).toMatch(/^https:\/\/github.com\/login\/oauth\/authorize/);

    nock.isDone();

    // Callback
    const res2 = await agent.get('/admin/auth/github/callback').query({ code }).redirects(4);
    console.log(res2.text);
    // use is authenticated
    const res3 = await agent.get('/admin');
    expect(res3.status).toBe(200);
    expect(res3.text).toContain('Hello, testuser');
  });

  it('should handle user cancelling login (access_denied)', async () => {
    const res = await agent
      .get('/auth/github/callback')
      .query({ error: 'access_denied', error_description: 'User denied access' })
      .redirects(0);

    expect(res.status).toBe(401);
    expect(res.text).toBe('Login failed');
  });

  it('should handle invalid GitHub response (missing access_token)', async () => {
    const code = 'testcode123';

    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(200, { token_type: 'bearer', scope: 'user:email' }); // No access_token

    const res = await agent.get('/admin/auth/github/callback').query({ code }).redirects(0);

    expect(res.status).toBe(401);
    expect(res.text).toBe('Login failed');
  });

  it('should handle state mismatch (CSRF)', async () => {
    // Simulate state mismatch by not setting session state
    const code = 'testcode123';
    const state = 'wrongstate';

    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(200, { access_token: 'mock-access-token', token_type: 'bearer', scope: 'user:email' });

    nock('https://api.github.com').get('/user').reply(200, { id: 123, login: 'testuser' });

    // No session state set, so passport should fail
    const res = await agent.get('/admin/auth/github/callback').query({ code, state }).redirects(0);

    expect(res.status).toBe(401);
    expect(res.text).toBe('Login failed');
  });

  it('should handle missing code parameter', async () => {
    const res = await agent.get('/admin/auth/github/callback').redirects(2);

    expect(res.status).toBe(401);
    expect(res.text).toBe('Login failed');
  });

  it.skip('should handle GitHub server error', async () => {
    const code = 'testcode123';

    nock('https://github.com')
      .post('/login/oauth/access_token')
      .reply(500, { error: 'server_error' });

    const res = await agent.get('/admin/auth/github/callback').query({ code }).redirects(0);

    expect(res.status).toBe(401);
    expect(res.text).toBe('Login failed');
  });
});
