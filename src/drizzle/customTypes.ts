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
    // TODO: to have better validation, specify a validation to run agains the data that was parsed
    return +value;
  },
});
