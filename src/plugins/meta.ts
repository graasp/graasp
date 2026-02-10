import { sql } from 'drizzle-orm';
import { StatusCodes } from 'http-status-codes';

import { type FastifyPluginAsyncTypebox, Type } from '@fastify/type-provider-typebox';
import type { FastifyBaseLogger, FastifySchema } from 'fastify';

import type { UnionOfConst } from '@graasp/sdk';

import { resolveDependency } from '../di/utils';
import { db } from '../drizzle/db';
import { SearchService } from '../services/item/plugins/publication/published/plugins/search/search.service';
import { assertIsError } from '../utils/assertions';
import {
  APP_VERSION,
  BUILD_TIMESTAMP,
  EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN,
  ETHERPAD_URL,
} from '../utils/config';

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

  fastify.get('/api/status', async (_, reply) => {
    const searchService = resolveDependency(SearchService);
    const api = new HealthyStatus().format();
    const database = (await getDBStatusCheck(fastify.log)).format();
    const etherpad = (await getEtherpadStatusCheck()).format();
    const meilisearch = (await getSearchStatusCheck(searchService)).format();
    const iframely = (await getIframelyStatusCheck()).format();

    // allow request cross origin
    reply.header('Access-Control-Allow-Origin', '*');
    return {
      api,
      database,
      meilisearch,
      etherpad,
      iframely,
      // add nudenet, etc...
    };
  });

  fastify.get('/api/version', async (_, reply) => {
    // allow request cross origin
    reply.header('Access-Control-Allow-Origin', '*');
    return `${APP_VERSION} @ ${BUILD_TIMESTAMP}`;
  });
};

const getDBStatusCheck = async (_log: FastifyBaseLogger): Promise<ServiceStatus> => {
  try {
    // this just checks that we can execute queries on the database.
    // if tables are locked it will still execute fine as long as the connection is working
    const res = await db.execute(sql`select 1 result;`);
    if (res.rows[0]['result'] === 1) {
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

const getEtherpadStatusCheck = async (): Promise<ServiceStatus> => {
  try {
    const etherpadApiEndpoint = new URL(`${ETHERPAD_URL}/api`);
    const res = await fetch(etherpadApiEndpoint.toString());
    if (res.ok) {
      const response = (await res.json()) as { currentVersion: string };
      return new HealthyStatus(`Running ${response.currentVersion}`);
    }
    return new UnHealthyStatus('Etherpad');
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

const getSearchStatusCheck = async (search: SearchService): Promise<ServiceStatus> => {
  try {
    const res = await search.getHealth();
    if (res.status) {
      return new HealthyStatus();
    }
    return new UnHealthyStatus('Meilisearch');
  } catch (err) {
    assertIsError(err);
    if ('code' in err && err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

export default plugin;
