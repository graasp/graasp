export type IdParam = {
  id: string;
};

export type IdsParams = {
  id: string[];
};

export type NonEmptyArray<T> = [T, ...T[]];
export function isNonEmptyArray<T>(arr: T[]): arr is NonEmptyArray<T> {
  return arr.length > 0;
}

export type KeysWithValsOfType<T, V> = keyof { [P in keyof T as T[P] extends V ? P : never]: P };
export type KeysOfString<T> = KeysWithValsOfType<T, string>;
