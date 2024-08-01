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

export function recursiveSerialize(value: any): any {
  if (typeof value === "undefined") return "REDIS_UNDEFINED";
  else if (value instanceof Date) {
    // Convert Date object to a string
    return `REDIS_DATE:${value.toISOString()}`;
  } else if (Array.isArray(value)) {
    // Recursively replace array elements
    return value.map(recursiveSerialize);
  } else if (value !== null && typeof value === "object") {
    // Recursively replace properties of objects
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, recursiveSerialize(v)])
    );
  } else {
    // Return the value if it's not an object or a Date
    return value;
  }
}

export function recursiveParse(value: any): any {
  if (value === "REDIS_UNDEFINED") return undefined;
  else if (typeof value === "string" && value.startsWith("REDIS_DATE:")) {
    return new Date(value.slice("REDIS_DATE:".length));
  } else if (Array.isArray(value)) {
    // Recursively replace array elements
    return value.map(recursiveParse);
  } else if (value !== null && typeof value === "object") {
    // Recursively replace properties of objects
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, recursiveParse(v)])
    );
  } else {
    // Return the value if it's not an object or a Date
    return value;
  }
}
