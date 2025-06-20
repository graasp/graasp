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
