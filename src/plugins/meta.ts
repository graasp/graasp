import fetch from 'node-fetch';
import { EntityManager } from 'typeorm';

import { FastifyPluginAsync } from 'fastify';

import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN, ETHERPAD_URL } from '../utils/config';

class BaseStatus {
  private isOk: boolean;
  private message: string;
  constructor(isOk: boolean, message: string) {
    this.message = message;
    this.isOk = isOk;
  }
  format() {
    return {
      status: this.isOk ? '✅' : '❌',
      message: this.message,
    };
  }
}
class OkStatus extends BaseStatus {
  constructor(message: string = 'Running') {
    super(true, message);
  }
}
class UnreachableStatus extends BaseStatus {
  constructor() {
    super(false, 'Service Unreachable');
  }
}
class UnexpectedErrorStatus extends BaseStatus {
  constructor(error: Error) {
    super(false, `Unexpected error: ${error.toString()}`);
  }
}
class NotOkStatus extends BaseStatus {
  constructor(serviceName: string) {
    super(false, `${serviceName} is not Ok.`);
  }
}

const plugin: FastifyPluginAsync = async (fastify) => {
  fastify.get('/status', async () => {
    const {
      db,
      search: { service: searchService },
    } = fastify;
    const api = new OkStatus().format();
    const database = (await getDBStatusCheck(db.manager)).format();
    const etherpad = (await getEtherpadStatusCheck()).format();
    const meilisearch = (await getSearchStatusCheck(searchService)).format();
    const iframely = (await getIframelyStatusCheck()).format();
    return {
      api,
      database,
      meilisearch,
      etherpad,
      iframely,
      // add nudenet, etc...
    };
  });
};

const getDBStatusCheck = async (manager: EntityManager): Promise<BaseStatus> => {
  try {
    // this just checks that we can execute queries on the database.
    // if tables are locked it will still execute fine as long as the connection is working
    const res = await manager.query('select 1 result;');
    if (res[0].result === 1) {
      return new OkStatus();
    }
    return new NotOkStatus('Database');
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

const getEtherpadStatusCheck = async (): Promise<BaseStatus> => {
  try {
    const etherpadApiEndpoint = new URL(`${ETHERPAD_URL}/api`);
    const res = await fetch(etherpadApiEndpoint.toString());
    if (res.ok) {
      const response = (await res.json()) satisfies { currentVersion: string };
      return new OkStatus(`Running ${response.currentVersion}`);
    }
    return new NotOkStatus('Etherpad');
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

const getIframelyStatusCheck = async (): Promise<BaseStatus> => {
  try {
    const iframelyEndpoint = new URL(`${EMBEDDED_LINK_ITEM_IFRAMELY_HREF_ORIGIN}/iframely`);
    iframelyEndpoint.searchParams.set('url', 'https://graasp.org');
    const res = await fetch(iframelyEndpoint.toString(), { method: 'HEAD' });
    if (res.ok) {
      return new OkStatus();
    }
    return new NotOkStatus('Iframely');
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

const getSearchStatusCheck = async (search: SearchService): Promise<BaseStatus> => {
  try {
    const res = await search.getHealth();
    if (res.status) {
      return new OkStatus();
    }
    return new NotOkStatus('Meilisearch');
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return new UnreachableStatus();
    }
    return new UnexpectedErrorStatus(err);
  }
};

export default plugin;
