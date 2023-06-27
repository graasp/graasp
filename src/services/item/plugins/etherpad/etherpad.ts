import { default as EtherpadApi } from '@graasp/etherpad-api';

import { EtherpadServerError } from './errors';

/**
 * A wrapper for Etherpad which converts errors into graasp error
 */
export const wrapErrors = (etherpad: EtherpadApi) =>
  new Proxy(etherpad, {
    get(target: EtherpadApi, property: string | symbol) {
      if (typeof target[property] === 'function') {
        return new Proxy(target[property], {
          apply: async (method, thisArg, args) => {
            const call = Reflect.apply(method, thisArg, args);
            if (!(call instanceof Promise)) {
              return call;
            }
            try {
              return await call;
            } catch (error) {
              throw new EtherpadServerError(error);
            }
          },
        });
      } else {
        return Reflect.get(target, property);
      }
    },
  });
