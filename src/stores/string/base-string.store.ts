import { SetOptions } from "redis";
import { RedisSet } from "../../redis-set";
import { BaseStore } from "../base-store";

export type StringParser<T = string> = {
  serialize: (value: T) => string;
  deserialize: (value: string) => T;
};

/**
 * Redis store for interacting with string data type
 */
export abstract class BaseStringStore<
  T = string,
  ID = string
> extends BaseStore<ID> {
  abstract readonly valueParser: StringParser<T>;

  /**
   * Sets a value in the store
   *
   * @param id - The ID/key to set
   *
   * @returns
   * - `"OK"`: if SET was executed correctly
   * - `null`: if the SET operation was not performed because the user specified the NX or XX option but the condition was not met
   *
   * @see {@link https://redis.io/commands/set}
   */
  async set(id: ID, value: T, options?: SetOptions): Promise<string | null> {
    const setOptions: SetOptions = options || {};
    if (this.ttl) setOptions["EX"] = this.ttl;

    return this.redis.set(
      this.toKey(id),
      this.valueParser.serialize(value),
      setOptions
    );
  }

  /**
   * Find by ID/key
   *
   * @param id - The ID/key to retrieve
   * @returns The retrieved value or null if not found.
   *
   * @see {@link https://redis.io/commands/get}
   */
  async get(id: ID): Promise<T | null> {
    const value = await this.redis.get(this.toKey(id));
    if (value === null) return null;
    return this.valueParser.deserialize(value);
  }

  async getOrThrow(id: ID): Promise<T> {
    const value = await this.redis.get(this.toKey(id));
    if (value === null) throw new Error(`Not found : ${id}`);
    return this.valueParser.deserialize(value);
  }

  /**
   * Retrieves multiple values from store
   *
   * @param ids - An array of ids to retrieve.
   * @returns An array of values corresponding to the ids.
   *
   * @see {@link https://redis.io/commands/mGet}
   */
  async mGet(...ids: ID[]): Promise<Array<T | null>> {
    if (!ids.length) return [];
    const values = await this.redis.mGet(this.toKeys(...ids));
    return values.map((v) =>
      v === null ? null : this.valueParser.deserialize(v)
    );
  }

  /**
   * Same as mGet but removes the missing values
   */
  async mGetClean(...ids: ID[]): Promise<Array<T>> {
    if (!ids.length) return [];
    const values = await this.redis.mGet(this.toKeys(...ids));
    const result: T[] = [];
    values.forEach((r) => {
      if (r === null) return;
      result.push(this.valueParser.deserialize(r));
    });

    return result;
  }

  async mGetMap(...ids: ID[]): Promise<Map<string, T | null>> {
    const map = new Map<string, T | null>();
    if (!ids.length) return map;
    const values = await this.redis.mGet(this.toKeys(...ids));
    for (let i = 0; i < ids.length; i++) {
      const value = values[i];
      map.set(
        this.serializeKey(ids[i]),
        value === null ? null : this.valueParser.deserialize(value)
      );
    }

    return map;
  }

  async mGetCleanMap(...ids: ID[]): Promise<Map<string, T>> {
    const map = new Map<string, T>();
    if (!ids.length) return map;
    const values = await this.redis.mGet(this.toKeys(...ids));
    for (let i = 0; i < ids.length; i++) {
      const value = values[i];
      if (value === null) continue;
      map.set(this.serializeKey(ids[i]), this.valueParser.deserialize(value));
    }

    return map;
  }

  async mGetObj(...ids: ID[]) {
    const map = await this.mGetMap(...ids);
    return Object.fromEntries(map);
  }

  async mGetCleanObj(...ids: ID[]) {
    const map = await this.mGetCleanMap(...ids);
    return Object.fromEntries(map);
  }

  /**
   * Sets the given IDs to their respective value
   *
   * @param kvs - An array of id value pairs
   * @returns `"OK"`
   *
   * @see {@link https://redis.io/commands/mSet}
   */
  async mSet(kvs: [ID, T][]): Promise<"OK"> {
    const mapped: [string, string][] = kvs.map(([k, v]) => [
      this.toKey(k),
      this.valueParser.serialize(v),
    ]);
    const ret = await this.redis.mSet(mapped);
    return ret as "OK";
  }

  /**
   * Retrieves all the values from the store
   *
   * `KEYS *` --> `MGET`
   * @returns An array of all the values in the store
   *
   * @see {@link https://redis.io/commands/keys}
   * @see {@link https://redis.io/commands/mget}
   */
  async getAll(): Promise<T[]> {
    const ids = await this.getAllIds();
    if (!ids.length) return [];
    return this.mGetClean(...ids);
  }

  /**
   * Retrieves all the values from the store as a map
   *
   * @returns A map with id-value pairs
   *
   * @see {@link https://redis.io/commands/keys}
   * @see {@link https://redis.io/commands/mget}
   */
  async getAllAsMap(): Promise<Map<string, T>> {
    const ids = await this.getAllIds();
    return this.mGetCleanMap(...ids);
  }

  /**
   * Retrieves all the values from the store as an object
   *
   * @returns An object with id-value pairs
   *
   * @see {@link https://redis.io/commands/keys}
   * @see {@link https://redis.io/commands/mget}
   */
  async getAllAsObject(): Promise<Record<string, T>> {
    const map = await this.getAllAsMap();
    return Object.fromEntries(map);
  }

  /**
   * Reloads the store with new values
   * Removes non-existing keys
   */
  async reload(kvs: [ID, T][]) {
    const keys = kvs.map((kv) => this.toKey(kv[0]));
    const oKeys = await this.getAllKeys();

    if (kvs.length) await this.mSet(kvs);

    const toRemove = oKeys.filter((o) => !keys.includes(o));
    if (!toRemove.length) return;

    await this.redis.del(toRemove);
  }

  createSet(key: string) {
    return new RedisSet({
      key: `${this.NAMESPACE}-set:${key}`,
      redis: this.redis,
    });
  }
}
