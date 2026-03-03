import { describe, expect, it } from 'vitest';

import { ITEM_NAME_REGEX } from './regex';

describe('Globals', () => {
  describe('Item name regex', () => {
    it('Name regex accepts words with spaces', () => {
      expect(new RegExp(ITEM_NAME_REGEX).test('Course')).toBeTruthy();
      expect(new RegExp(ITEM_NAME_REGEX).test('My Course')).toBeTruthy();
      expect(new RegExp(ITEM_NAME_REGEX).test('My Course from yesterday')).toBeTruthy();
      // double space is allowed (users have created content with it already)
      expect(new RegExp(ITEM_NAME_REGEX).test('My  Course')).toBeTruthy();
    });
    it('Name regex rejects string ending with spaces', () => {
      expect(new RegExp(ITEM_NAME_REGEX).test('My Course from yesterday ')).toBeFalsy();
      expect(new RegExp(ITEM_NAME_REGEX).test(' Course')).toBeFalsy();
    });
  });
});
