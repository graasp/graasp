export const anonymizeResults = <T, K extends keyof T, V extends T[K]>({
  results,
  exportingActorId,
  memberIdKey,
}: {
  results: T[];
  exportingActorId: string;
  memberIdKey: K[];
}) => {
  const anonymize = (_value: string) => 'xxx';

  return results.map((r) => {
    memberIdKey.forEach((k) => {
      if (r[k] !== exportingActorId) {
        r[k] = anonymize(String(r[k])) as V;
      }
    });

    return r;
  });
};
