import { DEFAULT_KEYGEN, RedisClient, RedisKeygen } from '../interfaces';
import { RedisStoreOptions } from './base-store.interface';

export interface RedisClientOption {
  client: RedisClient;
}

/**
 * A base class for creating various types of Redis stores
 */
export class BaseStore<ID = string> {
  readonly SEPARATOR: string;
  readonly NAMESPACE: string;
  readonly PREFIX: string;
  readonly ttl?: number;
  private readonly keygen: RedisKeygen<ID>;
  readonly redis: RedisClient;

  constructor(options: RedisStoreOptions<ID> & RedisClientOption) {
    this.redis = options.client;
    this.SEPARATOR = options.separator || ':';
    this.NAMESPACE = options.prefix;
    this.PREFIX = `${options.prefix}${this.SEPARATOR}`;
    this.ttl = options.ttl;
    this.keygen = options.keygen || DEFAULT_KEYGEN;
  }

  serializeKey(id: ID): string {
    return this.keygen.serialize(id);
  }

  parseKey(key: string): ID {
    return this.keygen.parse(key);
  }

  prefixKey(key: string) {
    if (key.startsWith(this.PREFIX)) return key;
    return `${this.PREFIX}${key}`;
  }

  unPrefixKey(key: string) {
    if (key.startsWith(this.PREFIX)) {
      return key.substring(this.PREFIX.length);
    }

    return key;
  }

  /**
   * Generate a redis key from given ID
   */
  toKey(id: ID): string {
    return this.prefixKey(this.serializeKey(id));
  }

  /**
   * Generates an array of redis keys from given IDs
   */
  toKeys(...ids: ID[]): string[] {
    return ids.map((key) => this.toKey(key));
  }

  /**
   * Retrieves ID from a redis key
   */
  toId(key: string): ID {
    return this.parseKey(this.unPrefixKey(key));
  }

  /**
   * Retrieves an array of IDs from an array of redis keys
   */
  toIds(...keys: string[]): ID[] {
    return keys.map((key) => this.toId(key));
  }

  /**
   * Removes the specified keys from the store
   *
   * @param ids IDs/keys to remove
   *
   * @returns The number of items that were removed
   *
   * @see {@link https://redis.io/commands/del}
   */
  async del(...ids: ID[]): Promise<number> {
    if (!ids.length) return 0;
    return this.redis.del(this.toKeys(...ids));
  }

  async delPatterns(...patterns: string[]): Promise<number> {
    if (!patterns.length) return 0;

    const keys = (
      await Promise.all(patterns.map((pattern) => this.keys(pattern)))
    ).flat();

    if (!keys.length) return 0;

    return this.redis.del(keys);
  }

  /**
   * Retrieves keys matching a pattern in the store
   *
   * Pattern is prefixed with the store's prefix
   *
   * @param {string} pattern The pattern to match keys against.
   * @returns An array of matching keys. Prefix is preserved on the keys.
   *
   * @see {@link https://redis.io/commands/keys}
   */
  async keys(pattern: string): Promise<string[]> {
    return this.redis.keys(this.prefixKey(pattern));
  }

  /**
   * Retrieves IDs matching a pattern in the store
   *
   * Pattern is prefixed with the store's prefix
   *
   * @param {string} pattern The pattern to match keys against.
   * @returns An array of matching IDs. Prefix is removed from the keys.
   *
   * @see {@link https://redis.io/commands/keys}
   */
  async ids(pattern: string): Promise<ID[]> {
    const keys = await this.keys(pattern);
    return this.toIds(...keys);
  }

  /**
   * Returns all keys in the store
   *
   * @returns An array of keys. Prefix is preserved in the keys.
   *
   * @see {@link https://redis.io/commands/keys}
   */
  async getAllKeys(): Promise<string[]> {
    return this.keys('*');
  }

  /**
   * Returns all IDs in the store
   *
   * @returns An array of IDs. Prefix is removed in IDs.
   *
   * @see {@link https://redis.io/commands/keys}
   */
  async getAllIds(): Promise<ID[]> {
    const keys = await this.keys('*');
    return this.toIds(...keys);
  }

  async reset(): Promise<number> {
    const keys = await this.getAllKeys();
    if (!keys.length) return 0;
    return this.redis.del(keys);
  }
}
