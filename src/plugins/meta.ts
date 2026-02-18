import { StatusCodes } from 'http-status-codes';
import fetch from 'node-fetch';
import { EntityManager } from 'typeorm';

import { FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox';
import { FastifySchema } from 'fastify';

import { UnionOfConst } from '@graasp/sdk';

import { assertIsError } from '../utils/assertions';
import { EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN } from '../utils/config';

const Status = {
  Healthy: 'healthy',
  Unhealthy: 'not-healthy',
  Unreachable: 'not-reachable',
  Unexpected: 'unexpected',
} as const;
type UnionOfServiceStatus = UnionOfConst<typeof Status>;

class ServiceStatus {
  private status: UnionOfServiceStatus;
  private message: string;
  constructor(status: UnionOfServiceStatus, message: string) {
    this.status = status;
    this.message = message;
  }
  format() {
    return {
      status: this.status,
      isHealthy: this.convertStatus(),
      message: this.message,
    };
  }
  convertStatus() {
    switch (this.status) {
      case Status.Healthy:
        return '✅';
      case Status.Unhealthy:
        return '⌛️';
      case Status.Unreachable:
        return '❌';
      case Status.Unexpected:
        return '⁉️';
    }
  }
}
class HealthyStatus extends ServiceStatus {
  constructor(message: string = 'Running') {
    super(Status.Healthy, message);
  }
}
class UnreachableStatus extends ServiceStatus {
  constructor() {
    super(Status.Unreachable, 'Service Unreachable');
  }
}
class UnexpectedErrorStatus extends ServiceStatus {
  constructor(error: Error) {
    super(Status.Unexpected, `Unexpected error: ${error.toString()}`);
  }
}
class UnHealthyStatus extends ServiceStatus {
  constructor(serviceName: string) {
    super(Status.Unhealthy, `${serviceName} is not Ok.`);
  }
}

const health = {
  operationId: 'health',
  tags: ['meta'],
  summary: 'Health check endpoint',
  description: 'Return a simple 200: OK when the server is running',
  response: {
    [StatusCodes.OK]: Type.Literal('OK'),
  },
} as const satisfies FastifySchema;

const plugin: FastifyPluginAsyncTypebox = async (fastify) => {
  fastify.get('/health', { schema: health }, async (_, reply) => {
    // allow request cross origin
    reply.header('Access-Control-Allow-Origin', '*');
    return 'OK' as const;
  });

  fastify.get('/status', async (_, reply) => {
    const { db } = fastify;
    const api = new HealthyStatus().format();
    const database = (await getDBStatusCheck(db.manager)).format();
    const iframely = (await getIframelyStatusCheck()).format();

    // allow request cross origin
    reply.header('Access-Control-Allow-Origin', '*');
    return {
      api,
      database,
      iframely,
      // add nudenet, etc...
    };
  });
};

const getDBStatusCheck = async (manager: EntityManager): Promise<ServiceStatus> => {
  try {
    // this just checks that we can execute queries on the database.
    // if tables are locked it will still execute fine as long as the connection is working
    const res = await manager.query('select 1 result;');
    if (res[0].result === 1) {
      return new HealthyStatus();
    }
    return new UnHealthyStatus('Database');
  } catch (err) {
    assertIsError(err);
    if ('code' in err && err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

const getIframelyStatusCheck = async (): Promise<ServiceStatus> => {
  try {
    const iframelyEndpoint = new URL(`${EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN}/iframely`);
    iframelyEndpoint.searchParams.set('url', 'https://graasp.org');
    const res = await fetch(iframelyEndpoint.toString(), { method: 'HEAD' });
    if (res.ok) {
      return new HealthyStatus();
    }
    return new UnHealthyStatus('Iframely');
  } catch (err) {
    assertIsError(err);
    if ('code' in err && err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

export default plugin;
