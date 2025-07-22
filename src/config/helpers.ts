export class ExpectedEnvVariable extends Error {
  constructor(envVarName: string) {
    super(`Expected to find env variable "${envVarName}" but it was undefined.`);
    this.name = 'MissingEnvVar';
  }
}

/**
 *
 * @param name the name of the env var
 * @throws an error if the var is not defined
 * @returns the env var value if it is defined
 */
export function requiredEnvVar(name: string) {
  const varValue = process.env[name];
  if (varValue === undefined) {
    throw new ExpectedEnvVariable(name);
  }
  return varValue;
}

/**
 * Convert a string value to a boolean.
 * Accepts `true` and `1` as true values.
 *
 * A default can be provided in the options. If not provided the value will be `false`.
 * @param value the value to convert to a boolean, can be a string or undefined
 * @param options an object containing a `default` key to be used when the value is not defined,
 * default to `false`
 * @returns the boolean value of the input
 */
export function toBoolean(value: string | undefined, options?: { default: boolean }) {
  if (value == undefined) {
    return options?.default ?? false;
  }
  if (value === 'true' || value === '1') {
    return true;
  }
  return false;
}
