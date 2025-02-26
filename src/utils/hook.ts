import { FastifyBaseLogger } from 'fastify';

import { DBConnection } from '../drizzle/db';
import { Actor } from '../types';
import { Repositories } from './repositories';

export type Handler<Data> = (
  actor: Actor,
  db: DBConnection,
  data: Data,
  log?: FastifyBaseLogger,
) => Promise<void>;

class HookManager<EventMap extends { [event: string]: { pre: unknown; post: unknown } }> {
  private readonly postHooks = new Map<keyof EventMap, Handler<unknown>[]>();
  private readonly preHooks = new Map<keyof EventMap, Handler<unknown>[]>();

  setPostHook<Event extends keyof EventMap>(
    event: Event,
    handler: Handler<EventMap[Event]['post']>,
  ) {
    const hooks = this.postHooks.get(event);
    if (!hooks) {
      this.postHooks.set(event, [handler]);
    } else {
      hooks.push(handler);
    }
  }

  async runPostHooks<Event extends keyof EventMap>(
    event: Event,
    actor: Actor,
    db: DBConnection,
    data: EventMap[Event]['post'],
    log?: FastifyBaseLogger,
  ) {
    // TODO: allsettled?
    const hooks = this.postHooks.get(event);
    if (hooks) {
      await Promise.all(hooks.map((f) => f(actor, db, data, log)));
    }
  }

  setPreHook<Event extends keyof EventMap>(event: Event, handler: Handler<EventMap[Event]['pre']>) {
    const hooks = this.preHooks.get(event);
    if (!hooks) {
      this.preHooks.set(event, [handler]);
    } else {
      hooks.push(handler);
    }
  }

  async runPreHooks<Event extends keyof EventMap>(
    event: Event,
    actor: Actor,
    db: DBConnection,
    data: EventMap[Event]['pre'],
    log?: FastifyBaseLogger,
  ) {
    // TODO: allsettled?
    const hooks = this.preHooks.get(event);
    if (hooks) {
      await Promise.all(hooks.map((f) => f(actor, db, data, log)));
    }
  }
}

export default HookManager;
