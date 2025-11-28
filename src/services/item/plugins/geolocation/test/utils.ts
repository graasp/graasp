import { expect } from 'vitest';

import type {
  ItemGeolocationRaw,
  ItemGeolocationWithItemWithCreator,
} from '../../../../../drizzle/types';
import type { PackedItemGeolocation } from '../itemGeolocation.service';

export const expectItemGeolocations = (
  results: ItemGeolocationRaw[] | null,
  expected: ItemGeolocationWithItemWithCreator[],
) => {
  for (const ig of expected) {
    expect(results).toContainEqual(
      expect.objectContaining({
        lat: ig.lat,
        lng: ig.lng,
        addressLabel: ig.addressLabel,
        helperLabel: ig.helperLabel,
        country: ig.country,
        item: expect.objectContaining({
          id: ig.item.id,
          path: ig.item.path,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creator: expect.objectContaining({ id: ig.item.creator!.id }),
        }),
      }),
    );
  }
};

export const expectPackedItemGeolocations = (
  results: PackedItemGeolocation[] | null,
  expected: PackedItemGeolocation[],
) => {
  expect(results).toHaveLength(expected.length);

  for (const ig of expected) {
    const publicTest = ig.item.public?.id
      ? { public: expect.objectContaining({ id: ig.item.public.id }) }
      : {};

    expect(results).toContainEqual(
      expect.objectContaining({
        lat: ig.lat,
        lng: ig.lng,
        addressLabel: ig.addressLabel,
        helperLabel: ig.helperLabel,
        country: ig.country,
        item: expect.objectContaining({
          id: ig.item.id,
          creator: ig.item.creator ? expect.objectContaining({ id: ig.item.creator.id }) : null,
          permission: ig.item.permission,
          ...publicTest,
        }),
      }),
    );
  }
};
