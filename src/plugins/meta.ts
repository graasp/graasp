import fetch from 'node-fetch';
import { EntityManager } from 'typeorm';

import { FastifyPluginAsync } from 'fastify';

import { SearchService } from '../services/item/plugins/published/plugins/search/service';
import { ETHERPAD_URL } from '../utils/config';

type GraaspServiceStatus = { isOk: boolean; message: string };

const plugin: FastifyPluginAsync = async (fastify) => {
  // get
  const {
    db,
    search: { service: searchService },
  } = fastify;

  fastify.get('/status', async () => {
    const dbCheck = await getDBStatusCheck(db.manager);
    const etherpadCheck = await getEtherpadStatusCheck();
    const searchCheck = await getSearchStatusCheck(searchService);
    return {
      api: { status: '✅', message: 'Running' },
      database: { status: dbCheck.isOk ? '✅' : '❌', message: dbCheck.message },
      // add meilisearch, etherpad, iframely, nudenet, etc...
      meilisearch: { status: searchCheck.isOk ? '✅' : '❌', message: searchCheck.message },
      etherpad: { status: etherpadCheck.isOk ? '✅' : '❌', message: etherpadCheck.message },
    };
  });
};

const getDBStatusCheck = async (manager: EntityManager): Promise<GraaspServiceStatus> => {
  try {
    // this just checks that we can execute queries on the database.
    // if tables are locked it will still execute fine as long as the connection is working
    const res = await manager.query('select 1 result;');
    if (res[0].result === 1) {
      return { isOk: true, message: 'Database is connected' };
    }
    return { isOk: false, message: 'Unexpected result' };
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return { isOk: false, message: 'Service unreachable' };
    }
    return { isOk: false, message: err.toString() };
  }
};

const getEtherpadStatusCheck = async (): Promise<GraaspServiceStatus> => {
  try {
    const etherpadApiEndpoint = new URL(`${ETHERPAD_URL}/api`);
    const res = await fetch(etherpadApiEndpoint.toString());
    if (res.ok) {
      const response = (await res.json()) satisfies { currentVersion: string };
      return { isOk: true, message: `Running ${response.currentVersion}` };
    }
    return { isOk: false, message: `Etherpad is not OK.\n${await res.json()}` };
  } catch (err) {
    if (err.code === 'ENOTFOUND') {
      return { isOk: false, message: 'Service unreachable' };
    }
    return { isOk: false, message: err.toString() };
  }
};

const getSearchStatusCheck = async (search: SearchService): Promise<GraaspServiceStatus> => {
  try {
    const res = await search.getHealth();
    console.log(res);
    if (res.status) {
      return { isOk: true, message: 'Running' };
    }
    return { isOk: false, message: 'Search is not OK.' };
  } catch (err) {
    console.log(err);
    if (err.code === 'ENOTFOUND') {
      return { isOk: false, message: 'Service unreachable' };
    }
    return { isOk: false, message: 'Service unreachable' };
  }
};

export default plugin;
