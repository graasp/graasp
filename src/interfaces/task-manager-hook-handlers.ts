import { PostHookHandlerType, PreHookHandlerType } from './task';

export interface TaskManagerHookHandlers<R> {
  setPreCopyHandler(handler: PreHookHandlerType<R>): void;
  unsetPreCopyHandler(handler: PreHookHandlerType<R>): void;

  setPostDeleteHandler(handler: PostHookHandlerType<R>): void;
  unsetPostDeleteHandler(handler: PostHookHandlerType<R>): void;
}
