// import BadWordsFilter from 'bad-words';
// import frenchBadwordsListPLugin from 'french-badwords-list';

// export const buildWordList = (badWordsFilter: BadWordsFilter): void => {
//   // this package does not have a TS one, so I have to use 'require' here
//   // eslint-disable-next-line @typescript-eslint/no-var-requires
//   const frenchBadwordsList = frenchBadwordsListPLugin.array as Array<string>;
//   badWordsFilter.addWords(...frenchBadwordsList);
// };

/**
 * TODO: This function code is disabled since there were a lot of false postivives being generated.
 * Legitimate descriptions would get falgged as containing bad words.
 *
 * There are multiple explanations for this:
 * - matching words based on regular expressions and lists does usually not provide a
 *   good user experience (more false positives than actual filtering of legitimate harassement)
 * - no language detection support, so the exhaustive list of swear words in french match agains legitimate content in other langauges
 *   Examples:
 *     - vier (synonym for penis if matched in german, means "four")
 *     - con (sommon insult in french is matched in spanish and italian)
 */
export const detectFieldNameWithBadWords = (
  _documents: {
    name: string;
    value: string;
  }[],
): string[] => {
  return [];
  // const contents = documents?.filter(Boolean);
  // const badWordsFilter = new BadWordsFilter();
  // buildWordList(badWordsFilter);
  // const suspiciousFields: string[] = [];
  // for (const { value, name } of contents) {
  //   if (badWordsFilter.isProfane(value)) {
  //     suspiciousFields.push(name);
  //   }
  // }
  // return suspiciousFields;
};
