import { StringParser } from "./base-string.store";

export const stringParser: StringParser<string> = {
  deserialize(value: string): string {
    return value;
  },
  serialize(value: string): string {
    return value;
  },
};

export const numberParser: StringParser<number> = {
  deserialize(value: string): number {
    const num = parseInt(value);
    if (isNaN(num)) {
      throw new Error(`Invalid number : ${value}`);
    }
    return num;
  },
  serialize(value: number): string {
    return value.toString();
  },
};

export const booleanParser: StringParser<boolean> = {
  deserialize(value: string): boolean {
    return value === "true";
  },
  serialize(value: boolean): string {
    return value ? "true" : "false";
  },
};

export function objectParser<T>(): StringParser<T> {
  return {
    deserialize(value: string): T {
      if (value === "REDIS_UNDEFINED") return undefined as T;
      return JSON.parse(value, (key, value) => {
        if (typeof value === "string" && value.startsWith("REDIS_DATE:")) {
          return new Date(value.slice("REDIS_DATE:".length));
        }
        return value;
      });
    },
    serialize(value: T): string {
      if (typeof value === "undefined") return "REDIS_UNDEFINED";
      return JSON.stringify(recursiveReplace(value));
    },
  };
}

function recursiveReplace(value: any): any {
  if (value instanceof Date) {
    // Convert Date object to a string
    return `REDIS_DATE:${value.toISOString()}`;
  } else if (Array.isArray(value)) {
    // Recursively replace array elements
    return value.map(recursiveReplace);
  } else if (value !== null && typeof value === "object") {
    // Recursively replace properties of objects
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, recursiveReplace(v)])
    );
  } else {
    // Return the value if it's not an object or a Date
    return value;
  }
}
