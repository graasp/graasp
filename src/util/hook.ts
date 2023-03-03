import { Member } from '../services/member/entities/member';
import { Repositories } from './repositories';

type Handler = (actor: Member, repositories: Repositories, args: any) => Promise<void>;

class HookManager {
  postHooks: {
    [key: string]: Handler[];
  } = {};

  preHooks: {
    [key: string]: Handler[];
  } = {};

  setPostHook(key, handler) {
    const hooks = this.postHooks[key];
    if (!hooks) {
      this.postHooks[key] = [handler];
    } else {
      this.postHooks[key].push(handler);
    }
  }

  async runPostHooks(key, actor, repositories, data) {
    // TODO: allsettled?
    if (this.postHooks[key]) {
      await Promise.all(this.postHooks[key].map((f) => f(actor, repositories, data)));
    }
  }

  setPreHook(key, handler) {
    const hooks = this.preHooks[key];
    if (!hooks) {
      this.preHooks[key] = [handler];
    } else {
      this.preHooks[key].push(handler);
    }
  }

  async runPreHooks(key, actor, repositories, data) {
    // TODO: allsettled?
    if (this.preHooks[key]) {
      await Promise.all(this.preHooks[key].map((f) => f(actor, repositories, data)));
    }
  }
}

export default HookManager;
