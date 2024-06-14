import { InjectionToken, container } from 'tsyringe';

export const resolveDependency = <T>(injectionToken: InjectionToken<T> | string) => {
  return container.resolve<T>(injectionToken);
};

/**
 * Clear all previously created and registered instances.
 * This is very usefull in the tests to ensure to have new Singleton instance in every test.
 */
export const resetDependencies = () => {
  container.clearInstances();
};

export const registerValue = <T>(injectionToken: InjectionToken<T> | string, value: T) => {
  container.register(injectionToken, { useValue: value });
};
