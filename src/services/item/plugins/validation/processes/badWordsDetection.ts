import BadWordsFilter from 'bad-words';
import frenchBadwordsListPLugin from 'french-badwords-list';

export const buildWordList = (badWordsFilter: BadWordsFilter): void => {
  // this package does not have a TS one, so I have to use 'require' here
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const frenchBadwordsList = frenchBadwordsListPLugin.array as Array<string>;
  badWordsFilter.addWords(...frenchBadwordsList);
};

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
