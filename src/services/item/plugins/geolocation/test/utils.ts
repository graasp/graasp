import { ItemGeolocation, PackedItemGeolocation } from '../ItemGeolocation';

export const expectItemGeolocations = (
  results: ItemGeolocation[] | null,
  expected: ItemGeolocation[],
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
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          creator: expect.objectContaining({ id: ig.item.creator!.id }),
          permission: ig.item.permission,
          ...publicTest,
        }),
      }),
    );
  }
};
