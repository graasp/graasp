/**
 * Check that only the wanted props are present and the value are as expected.
 * Wanted and unwanted props must be mutual exlusive.
 *
 * @param results: The objects to validate.
 * @param expectactions: The objects to use for validation.
 * @param wantedProps: The valid props to compare between the results and expectations.
 * @param unwantedProps: The unvalid props that results should not have.
 * @param mustContainsAllProps: If true, all the props must be dispatched in wanted or unwanted.
 */
export const expectObjects = <T extends { id: string }, K extends keyof T = keyof T>({
  results,
  expectations,
  wantedProps,
  typeName = 'object',
}: {
  results: T[];
  expectations: T[];
  wantedProps: K[];
  typeName?: string;
}) => {
  console.log(`Testing ${typeName}.`);
  expect(results).toHaveLength(expectations.length);

  const allProps = Object.keys(results[0]);

  for (const expected of expectations) {
    const result = results.find((a) => a.id === expected.id);
    if (!result) {
      throw new Error(`${typeName} should exist`);
    }

    const missingWantedProps = allProps.filter((e) => !wantedProps.includes(e as K));

    if (missingWantedProps.length) {
      expect(() => {
        throw new Error(
          `The props "${missingWantedProps.join(
            ', ',
          )}" are in the results but not in the wanted props.
         This can lead to an unwanted leak ! If it is wanted, please update the wanted array.`,
        );
      }).not.toThrow();
    }

    wantedProps.forEach((prop) => expect(result[prop]).toEqual(expected[prop]));
  }
};

/**
 * Checks that the exported resource doesn't contain an unanonymized member ID of another member.
 *
 * @param resource The exported resource.
 * @param exportActorId The ID of the member who exported the resource.
 * @param memberId The ID of the member ID who must be anonymized.
 * @param memberIdKey The prop name of the member ID of the given resource.
 */
export const expectNotLeakMemberId = <T>({
  resource,
  exportActorId,
  memberId,
}: {
  resource: T;
  exportActorId: string;
  memberId?: string;
}) => {
  const lowerMemberId = memberId?.toLocaleLowerCase();
  const lowerActorId = exportActorId.toLocaleLowerCase();
  // If there is a member ID who is not the exported actor,
  // check that the id is anonymized.
  if (lowerMemberId && lowerMemberId !== lowerActorId) {
    const stringified = JSON.stringify(resource).toLocaleLowerCase();
    if (stringified.includes(lowerMemberId)) {
      expect(() => {
        throw new Error(`The member ID ${memberId} is leaked !`);
      }).not.toThrow();
    }
  }
};
