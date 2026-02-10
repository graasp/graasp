import type { ItemOpFeedbackEvent } from '@graasp/sdk';

import type { MembershipEvent } from '../../../../itemMembership/ws/events';
import { type ItemRaw } from '../../../item';
import { expectItem, expectManyItems } from '../../../test/fixtures/items';

export const expectExportFeedbackOp = <
  S extends {
    id: string;
  },
>(
  result: ItemOpFeedbackEvent<S, 'export'>,
  expected: ItemOpFeedbackEvent<S, 'export'>,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);
  expect(result.resource).toEqual(expected.resource);
  if (expected.result) {
    expectItem(Object.values(result.result!)[0], Object.values(expected.result)[0]);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectCopyFeedbackOp = (
  result: ItemOpFeedbackEvent<ItemRaw, 'copy'>,
  expected: ItemOpFeedbackEvent<ItemRaw, 'copy'>,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);
  expect(result.resource).toEqual(expected.resource);
  if (expected.result) {
    expectManyItems(result.result!.items, expected.result!.items);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectMoveFeedbackOp = (
  result: ItemOpFeedbackEvent<ItemRaw, 'move'>,
  expected: ItemOpFeedbackEvent<ItemRaw, 'move'>,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);
  expect(result.resource).toEqual(expected.resource);
  if (expected.result) {
    expectManyItems(result.result!.items, expected.result!.items);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectDeleteFeedbackOp = (
  result: ItemOpFeedbackEvent<ItemRaw, 'delete'>,
  expected: ItemOpFeedbackEvent<ItemRaw, 'delete'>,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);
  expect(result.resource).toEqual(expected.resource);

  if (expected.result) {
    expectItem(Object.values(result.result!)[0], Object.values(expected.result)[0]);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectUpdateFeedbackOp = <
  S extends {
    id: string;
  },
>(
  result: ItemOpFeedbackEvent<S, 'update'>,
  expected: ItemOpFeedbackEvent<S, 'update'>,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);
  expect(result.resource).toEqual(expected.resource);
  if (expected.result) {
    expectItem(Object.values(result.result!)[0], Object.values(expected.result)[0]);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectValidateFeedbackOp = <
  S extends {
    id: string;
  },
>(
  result: ItemOpFeedbackEvent<S, 'validate'>,
  expected: ItemOpFeedbackEvent<S, 'validate'>,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);
  expect(result.resource).toEqual(expected.resource);
  if (expected.result) {
    expectItem(Object.values(result.result!)[0], Object.values(expected.result)[0]);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectDeleteMembershipFeedback = (
  result: MembershipEvent,
  expected: MembershipEvent,
) => {
  expect(result.kind).toEqual(expected.kind);
  expect(result.op).toEqual(expected.op);

  const resultMembership = result.membership;
  const expectedM = expected.membership;
  expect(resultMembership.permission).toEqual(expectedM.permission);
  expect(resultMembership.itemPath).toContain(expectedM.itemPath);
  expect(resultMembership.creatorId).toEqual(expectedM.creatorId);
  expect(resultMembership.accountId).toEqual(expectedM.accountId);
};
