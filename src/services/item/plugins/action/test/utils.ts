import { ItemOpFeedbackEvent } from '@graasp/sdk';

import { Item } from '../../../entities/Item';
import { expectManyItems } from '../../../test/fixtures/items';

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
    expect(result.result!.id).toEqual(expected.result!.id);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};

export const expectCopyFeedbackOp = (
  result: ItemOpFeedbackEvent<Item, 'copy'>,
  expected: ItemOpFeedbackEvent<Item, 'copy'>,
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

export const expectMoveFeedbackOp = <
  S extends {
    id: string;
  },
>(
  result: ItemOpFeedbackEvent<S, 'move'>,
  expected: ItemOpFeedbackEvent<S, 'move'>,
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

export const expectDeleteFeedbackOp = <
  S extends {
    id: string;
  },
>(
  result: ItemOpFeedbackEvent<S, 'delete'>,
  expected: ItemOpFeedbackEvent<S, 'delete'>,
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
    expectManyItems(result.result!.items, expected.result!.items);
  }
  if (expected.errors) {
    expect(result.errors).toEqual(expected.errors);
  }
};
