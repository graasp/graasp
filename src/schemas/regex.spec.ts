import { describe, expect, it } from 'vitest';

import { EMPTY_OR_SPACED_WORDS_REGEX, ITEM_NAME_REGEX } from './regex';

describe('Globals', () => {
  describe('Item name regex', () => {
    it('Name regex accepts words with spaces', () => {
      expect(new RegExp(ITEM_NAME_REGEX).test('Course')).toBeTruthy();
      expect(new RegExp(ITEM_NAME_REGEX).test('My Course')).toBeTruthy();
      expect(new RegExp(ITEM_NAME_REGEX).test('My Course from yesterday')).toBeTruthy();
    });
    it('Name regex rejects string ending with spaces', () => {
      expect(new RegExp(ITEM_NAME_REGEX).test('My Course from yesterday ')).toBeFalsy();
      expect(new RegExp(ITEM_NAME_REGEX).test(' Course')).toBeFalsy();
      expect(new RegExp(ITEM_NAME_REGEX).test('My  Course')).toBeFalsy();
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
