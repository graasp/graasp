export class UndefinedVariableError extends Error {
  constructor(envVarName: string) {
    super(`Expected the variable "${envVarName}" to be defined.`);
    this.name = 'UndefinedVar';
  }
}

export class UrlMissingProtocolError extends Error {
  constructor(name: string) {
    super(`Expected to find the HTTP protocol for the variable "${name}", but it was not found.`);
    this.name = 'MissingProtocolVar';
  }
}

export class InvalidUrlError extends Error {
  constructor(name: string) {
    super(`The variable "${name}" is not a valid URL.`);
    this.name = 'InvalidUrlVar';
  }
}

export class RegexValidatorError extends Error {
  constructor(name: string, regex: RegExp) {
    super(`The variable "${name}" should have format "${regex}".`);
    this.name = 'RegexInvalidVar';
  }
}
