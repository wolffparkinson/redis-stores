import { recursiveParse, recursiveSerialize } from "../../utils";
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
      return recursiveParse(JSON.parse(value));
    },
    serialize(value: T): string {
      return JSON.stringify(recursiveSerialize(value));
    },
  };
}
