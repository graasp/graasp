import { describe, expect, it } from 'vitest';

import { detectFieldNameWithBadWords } from './badWordsDetection';

describe('detectFieldNameWithBadWords', () => {
  it('No bad words', async () => {
    const result = detectFieldNameWithBadWords([{ name: 'name', value: 'value' }]);
    expect(result).toHaveLength(0);
  });
  // this test is disabled since the bad words validation is disabled
  it.skip('Bad words should return name', async () => {
    const doc = [
      { name: 'name', value: 'fuck' },
      { name: 'name1', value: 'ok' },
      { name: 'name2', value: 'fuck' },
    ];
    const result = detectFieldNameWithBadWords(doc);
    expect(result).toContain(doc[0].name);
    expect(result).toContain(doc[2].name);
    expect(result).toHaveLength(2);
  });
});
