// Used to avoid using Jest's fake timers and Date.now mocks
// See https://github.com/TheBrainFamily/wait-for-expect/issues/4 and
// https://github.com/TheBrainFamily/wait-for-expect/issues/12 for more info
const globalObj = typeof window === 'undefined' ? global : window;

// Currently this fn only supports jest timers, but it could support other test runners in the future.
function runWithRealTimers(callback: () => typeof setTimeout) {
  const usingJestFakeTimers =
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalObj.setTimeout as any)._isMockFunction && typeof jest !== 'undefined';

  if (usingJestFakeTimers) {
    jest.useRealTimers();
  }

  const callbackReturnValue = callback();

  if (usingJestFakeTimers) {
    jest.useFakeTimers();
  }

  return callbackReturnValue;
}

function getSetTimeoutFn() {
  return runWithRealTimers(() => globalObj.setTimeout);
}

const defaults = {
  timeout: 4500,
  interval: 50,
};

/**
 * Waits for the expectation to pass and returns a Promise
 *
 * @param  expectation  Function  Expectation that has to complete without throwing
 * @param  timeout  Number  Maximum wait interval, 4500ms by default
 * @param  interval  Number  Wait-between-retries interval, 50ms by default
 * @return  Promise  Promise to return a callback result
 */
export const waitForExpect = function waitForExpect(
  expectation: () => void | Promise<void>,
  timeout = defaults.timeout,
  interval = defaults.interval,
) {
  const setTimeout = getSetTimeoutFn();

  if (interval < 1) {
    interval = 1;
  }
  const maxTries = Math.ceil(timeout / interval);
  let tries = 0;
  return new Promise<void>((resolve, reject) => {
    const rejectOrRerun = (error: Error) => {
      if (tries > maxTries) {
        reject(error);
        return;
      }
      setTimeout(runExpectation, interval);
    };
    function runExpectation() {
      tries += 1;
      try {
        Promise.resolve(expectation())
          .then(() => resolve())
          .catch(rejectOrRerun);
      } catch (error) {
        rejectOrRerun(error);
      }
    }
    setTimeout(runExpectation, 0);
  });
};
