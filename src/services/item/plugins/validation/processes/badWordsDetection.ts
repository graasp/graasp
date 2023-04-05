import BadWordsFilter from 'bad-words';
import frenchBadwordsListPLugin from 'french-badwords-list';

export const buildWordList = (badWordsFilter: BadWordsFilter): void => {
  // this package does not have a TS one, so I have to use 'require' here
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const frenchBadwordsList = frenchBadwordsListPLugin.array as Array<string>;
  badWordsFilter.addWords(...frenchBadwordsList);
};

export const checkBadWords = (
  documents: {
    name: string;
    value: string;
  }[],
): string[] => {
  const contents = documents?.filter(Boolean);
  const badWordsFilter = new BadWordsFilter();
  buildWordList(badWordsFilter);
  const suspiciousFields: string[] = [];
  for (const index in contents) {
    if (badWordsFilter.isProfane(contents[index].value)) {
      suspiciousFields.push(contents[index].name);
    }
  }
  return suspiciousFields;
};
