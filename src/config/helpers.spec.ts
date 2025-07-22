import { describe, expect, it } from 'vitest';

import { toBoolean } from './helpers';

describe('toBoolean', () => {
  it('undefined value', () => {
    expect(toBoolean(undefined, { default: true })).toEqual(true);
    expect(toBoolean(undefined, { default: false })).toEqual(false);
    expect(toBoolean(undefined)).toEqual(false);
  });
  it('string boolean value', () => {
    expect(toBoolean('true')).toEqual(true);
    expect(toBoolean('false')).toEqual(false);
    expect(toBoolean('toto')).toEqual(false);
  });
  it('number value', () => {
    expect(toBoolean('1')).toEqual(true);
    expect(toBoolean('0')).toEqual(false);
    expect(toBoolean('4')).toEqual(false);
  });
});
