import { EMPTY_OR_SPACED_WORDS_REGEX, NAME_REGEX } from './global';

describe('Globals', () => {
  describe('Name regex', () => {
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

  describe('Empty or spaced words regex', () => {
    it('Regex accepts words separated with one space', () => {
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('Bob')).toBeTruthy();
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('Bob and Alice')).toBeTruthy();
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('Bob and Alice')).toBeTruthy();
    });
    it('Regex accepts empty string', () => {
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('')).toBeTruthy();
    });
    it('Regex rejects string ending with spaces', () => {
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('Bob ')).toBeFalsy();
    });
    it('Regex rejects string starting with spaces', () => {
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test(' Bob')).toBeFalsy();
    });
    it('Regex rejects words separated with multiple spaces', () => {
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('Bob  Alice')).toBeFalsy();
      expect(new RegExp(EMPTY_OR_SPACED_WORDS_REGEX).test('Bob   Alice')).toBeFalsy();
    });
  });
});
