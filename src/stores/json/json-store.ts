import { recursiveParse, recursiveSerialize, removeNulls } from "../../utils";
import { BaseStore } from "../base-store";

type KeyValueResolvable<T, ID = string> =
  | [ID, T][]
  | Map<string, T>
  | Record<string, T>;

export class JsonStore<
  T extends object = object,
  ID = string
> extends BaseStore<ID> {
  private serializeValue(value: T) {
    return recursiveSerialize(value);
  }

  private parseValue(value: any): T {
    return recursiveParse(value);
  }

  /**
   * Retrieves a JSON object
   *
   * @param id - ID/key to retrieve
   * @see {@link https://redis.io/commands/json.get}
   */
  async get(id: ID): Promise<T | null> {
    const value = await this.redis.json.get(this.toKey(id));
    return this.parseValue(value);
  }

  /**
   * Retrieves all the values from the store
   *
   * `KEYS *` --> `MGET`
   * @returns An array of all the values in the store
   *
   * @see {@link https://redis.io/commands/keys}
   * @see {@link https://redis.io/commands/json.mget}
   */
  async getAll(): Promise<T[]> {
    const ids = await this.getAllIds();
    if (!ids.length) return [];
    return this.mGetClean(...ids);
  }

  /**
   * Retrieves multiple values from store
   *
   * @param ids - An array of ids to retrieve.
   * @returns An array of values corresponding to the ids.
   *
   * @see {@link https://redis.io/commands/json.mget}
   */
  async mGet(...ids: ID[]): Promise<Array<T | null>> {
    if (!ids.length) return [];
    const values = await this.redis.json.mGet(this.toKeys(...ids), ".");
    return values.map((v) => this.parseValue(v));
  }

  /**
   * Same as mGet but removes nulls
   */
  async mGetClean(...ids: ID[]): Promise<Array<T>> {
    return removeNulls(await this.mGet(...ids));
  }

  async mGetMap(...ids: ID[]): Promise<Map<string, T | null>> {
    const map = new Map<string, T | null>();
    if (!ids.length) return map;
    const values = await this.mGet(...ids);
    for (let i = 0; i < ids.length; i++) {
      const value = values[i];
      map.set(this.serializeKey(ids[i]), value);
    }

    return map;
  }

  async mGetCleanMap(...ids: ID[]): Promise<Map<string, T>> {
    const map = new Map<string, T>();
    if (!ids.length) return map;
    const values = await this.mGet(...ids);
    for (let i = 0; i < ids.length; i++) {
      const value = values[i];
      if (value === null) continue;
      map.set(this.serializeKey(ids[i]), value);
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

  async set(id: ID, value: T): Promise<string | null> {
    return this.redis.json.set(this.toKey(id), "$", this.serializeValue(value));
  }

  async mSet(data: KeyValueResolvable<T, ID>): Promise<"OK"> {
    const kvs = this.toKeyValues(data);
    const ret = await this.redis.json.mSet(
      kvs.map(([k, v]) => ({
        path: "$",
        key: this.toKey(k),
        value: this.serializeValue(v),
      }))
    );
    return ret as "OK";
  }

  /**
   * Reloads the store with new values
   * Removes non-existing keys
   */
  async reload(data: KeyValueResolvable<T, ID>) {
    const kvs = this.toKeyValues(data);
    const keys = kvs.map((kv) => this.toKey(kv[0]));
    const oKeys = await this.getAllKeys();

    if (kvs.length) await this.mSet(kvs);

    const toRemove = oKeys.filter((o) => !keys.includes(o));
    if (!toRemove.length) return;

    await this.redis.del(toRemove);
  }

  private toKeyValues(kvs: KeyValueResolvable<T, ID>): [ID, T][] {
    if (Array.isArray(kvs)) return kvs;
    return Object.entries(kvs).map(([k, v]) => [this.parseKey(k), v]);
  }
}
