/**
 * Removes `null` values from an array.
 * @param array The input array to filter.
 * @returns correctly typed array
 */
export function removeNulls<T>(array: Array<T | null>): T[] {
  return array.filter((a): a is T => a !== null);
}

export type Mapped<D, S> = {
  [K in keyof S]: K extends keyof D ? D[K] : never;
};
