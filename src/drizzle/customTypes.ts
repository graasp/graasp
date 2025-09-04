import { customType } from 'drizzle-orm/pg-core';

export const ltree = customType<{ data: string }>({
  dataType() {
    return 'ltree';
  },
});

export const customNumeric = customType<{ data: number; driverData: string }>({
  dataType() {
    return 'numeric';
  },
  toDriver(value: number): string {
    return String(value);
  },
  fromDriver(value: string): number {
    // TODO: to have better validation, specify a validation to run against the data that was parsed
    return +value;
  },
});

export const binaryHash = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

export const binary = customType<{
  data: Buffer;
  default: false;
}>({
  dataType() {
    return 'bytea';
  },
});
