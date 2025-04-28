import { InvalidUrlError, RegexValidatorError, UrlMissingProtocolError } from './errors';
import { Validator, Variable } from './types';
import { urlContainsProtocol, valueShouldBeDefined } from './utils';

export class UrlValidator implements Validator {
  public validate({ name, value }: Variable) {
    const strUrl = valueShouldBeDefined(name, value);

    // if the HTTP protocol is missing, throw an exception.
    if (!urlContainsProtocol(strUrl)) {
      throw new UrlMissingProtocolError(name);
    }

    // try to create an URL object to validate the string.
    // if the URL is not valid, throw an exception.
    try {
      const _url = new URL(strUrl);
      return { name, value: strUrl };
    } catch (_e) {
      throw new InvalidUrlError(name);
    }
  }
}

export class RegexValidator implements Validator {
  private readonly regex: RegExp;

  constructor(regex: RegExp) {
    this.regex = regex;
  }

  public validate({ name, value }: Variable) {
    const str = valueShouldBeDefined(name, value);

    if (!str.match(this.regex)) {
      throw new RegexValidatorError(name, this.regex);
    }

    return { name, value: str };
  }
}
