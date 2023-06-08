import { Actor } from '../services/member/entities/member';
import { Repositories } from './repositories';

export type Handler<Data> = (actor: Actor, repositories: Repositories, data: Data) => Promise<void>;

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
    repositories: Repositories,
    data: EventMap[Event]['post'],
  ) {
    // TODO: allsettled?
    const hooks = this.postHooks.get(event);
    if (hooks) {
      await Promise.all(hooks.map((f) => f(actor, repositories, data)));
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
    repositories: Repositories,
    data: EventMap[Event]['pre'],
  ) {
    // TODO: allsettled?
    const hooks = this.preHooks.get(event);
    if (hooks) {
      await Promise.all(hooks.map((f) => f(actor, repositories, data)));
    }
  }
}

export default HookManager;
