import { Ajv, type JSONSchemaType, type Schema } from 'ajv';
import fastJson from 'fast-json-stringify';
import { expect } from 'vitest';

export const expectNoLeaksAndEquality = <T extends object & { id: string }>(
  results: T[],
  expectations: T[],
  schema: Schema | JSONSchemaType<unknown>,
) => {
  expectNoLeakedColumns(results, schema);
  expectEquality(results, expectations, schema as object);
};

const expectNoLeakedColumns = <T>(results: T[], schema: Schema | JSONSchemaType<unknown>) => {
  const ajv = new Ajv({ allErrors: true });
  const validate = ajv.compile(schema);

  results.forEach((res) => {
    if (!validate(res) && validate.errors) {
      expect(() => {
        throw new Error(`Validation errors: ${JSON.stringify(validate.errors)}.`);
      }).not.toThrow();
    }
  });
};

const expectEquality = <T extends object & { id: string }>(
  results: T[],
  expectations: T[],
  schema: object,
) => {
  expect(results.length).toEqual(expectations.length);
  const stringify = fastJson(schema);
  results.forEach((res) => {
    const expectation = expectations.find((e) => e.id === res.id);
    expect(expectation).toBeDefined();
    expect(stringify(res)).toEqual(stringify(expectation));
  });
};

/**
 * Checks that the exported resource doesn't contain an unanonymized member ID of another member.
 *
 * @param resource The exported resource.
 * @param exportActorId The ID of the member who exported the resource.
 * @param memberId The ID of the member ID who must be anonymized.
 * @param memberIdKey The prop name of the member ID of the given resource.
 */
export const expectNoLeakMemberId = <T>({
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
