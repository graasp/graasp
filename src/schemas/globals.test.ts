import { NAME_REGEX } from './global';

describe('Globals', () => {
  it('Name regex accepts words with spaces', () => {
    expect(new RegExp(NAME_REGEX).test('Bob')).toBeTruthy();
    expect(new RegExp(NAME_REGEX).test('Bob and Alice')).toBeTruthy();
    expect(new RegExp(NAME_REGEX).test('Bob and Alice')).toBeTruthy();
  });
  it('Name regex rejects string ending with spaces', () => {
    expect(new RegExp(NAME_REGEX).test('Bob ')).toBeFalsy();
    expect(new RegExp(NAME_REGEX).test(' Bob')).toBeFalsy();
    expect(new RegExp(NAME_REGEX).test('Bob  Alice')).toBeFalsy();
  });
});
