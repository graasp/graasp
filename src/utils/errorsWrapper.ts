interface CustomError {
  new (data?: unknown): object;
}

function isFunction<T extends object>(target: T, property: string | symbol) {
  return typeof target[property] === 'function';
}

// Decorates a function to wrap errors in a custom error class.
function decorateFunctionForErrorHandling<T extends object>(
  target: T,
  property: string | symbol,
  receiver: typeof Proxy<T>,
  FallBackError: CustomError,
) {
  // This function returns a callback that can accept any number of arguments.
  // This is because the callback itself wraps the original function call.
  // When you call the returned function, you provide the arguments that
  // will be passed on to the original function.
  return async (...args: unknown[]) => {
    try {
      // Calls the function on the target object.
      const call = Reflect.apply(target[property], receiver, args);
      return await call;
    } catch (error) {
      // Throw a new custom error if exception raised during the call.
      throw new FallBackError(error);
    }
  };
}

/**
 * Wraps all function calls on the target object to throw a custom error type on exceptions.
 *
 * @param target The object to decorate with error handling.
 * @param FallBackError The class error to throw.
 * @returns A new Proxy object that intercepts function calls and throws custom errors.
 */
export const wrapErrorsWithCustom = <T extends object>(target: T, FallBackError: CustomError) => {
  const handler: ProxyHandler<T> = {
    // Intercept property access on the target object
    get(target, property: string | symbol, receiver: typeof Proxy<T>) {
      // If not a function, return the property value directly (similar to `target[property]`).
      if (!isFunction(target, property)) {
        return Reflect.get(target, property, receiver);
      }

      // If it's a function, decorate functions to wrap errors with the custom error type.
      return decorateFunctionForErrorHandling(target, property, receiver, FallBackError);
    },
  };

  return new Proxy(target, handler);
};
