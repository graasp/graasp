/**
 *
 * @param results: The objects to validate.
 * @param expectactions: The objects to use for validation.
 * @param wantedProps: The props to compare between the results and expectations.
 * @param unwantedProps: The props that results should not have.
 */
export const expectObjects = <T extends { id: string }, K extends keyof T = keyof T>({
  results,
  expectations,
  wantedProps,
  unwantedProps = [],
  typeName = 'object',
}: {
  results: T[];
  expectations: T[];
  wantedProps: K[];
  unwantedProps?: K[];
  typeName?: string;
}) => {
  console.log(`Testing ${typeName}.`);
  expect(results).toHaveLength(expectations.length);

  for (const expected of expectations) {
    const result = results.find((a) => a.id === expected.id);
    if (!result) {
      throw new Error(`${typeName} should exist`);
    }

    wantedProps.forEach((prop) => expect(result[prop]).toEqual(expected[prop]));
    unwantedProps.forEach((prop) => expect(result).not.toHaveProperty(String(prop)));
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
export const expectNotLeakMemberId = <T, K extends keyof T>({
  resource,
  exportActorId,
  memberId,
  memberIdKey,
}: {
  resource: T;
  exportActorId: string;
  memberId?: string;
  memberIdKey: K[];
}) => {
  const resCreatorId = memberIdKey.map((k) => resource[k]);
  expect(resCreatorId.length).toBeGreaterThan(0);

  // If there is a member ID who is not the exported actor,
  // check that the id is anonymized.
  if (memberId !== exportActorId) {
    resCreatorId.forEach((rId) => expect(rId).not.toEqual(memberId));
  }
};
