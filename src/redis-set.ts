import {
  DEFAULT_KEYGEN,
  type RedisClient,
  type RedisKeygen,
} from "./interfaces";

export interface RedisSetOptions<ID = string> {
  redis: RedisClient;
  key: string;
  keygen?: RedisKeygen<ID>;
}

export class RedisSet<ID = string> {
  private readonly redis: RedisClient;
  private readonly key: string;
  private readonly keygen: RedisKeygen<ID>;

  constructor(private readonly options: RedisSetOptions<ID>) {
    this.redis = options.redis;
    this.key = options.key;
    this.keygen = options.keygen || DEFAULT_KEYGEN;
  }

  serializeKey(id: ID): string {
    return this.keygen.serialize(id);
  }

  parseKey(key: string): ID {
    return this.keygen.parse(key);
  }

  /**
   * Add the specified members to the set stored at key.
   * Specified members that are already a member of this set are ignored.
   * If key does not exist, a new set is created before adding the specified members.
   * https://redis.io/docs/latest/commands/sadd/
   */
  async add(...ids: ID[]) {
    return this.redis.sAdd(
      this.key,
      ids.map((id) => this.serializeKey(id))
    );
  }

  /**
   * Remove the specified members from the set stored at key. Specified members that are not a member of this set are ignored.
   * If key does not exist, it is treated as an empty set and this command returns 0.
   */
  async remove(...ids: ID[]) {
    return this.redis.sRem(
      this.key,
      ids.map((id) => this.serializeKey(id))
    );
  }

  /**
   * Returns if member is a member of the set stored at key.
   */
  async has(id: ID) {
    return this.redis.sIsMember(this.key, this.serializeKey(id));
  }

  /**
   * Returns all the members of the set value stored at key.
   */
  async members(): Promise<ID[]> {
    const members = await this.redis.sMembers(this.key);
    return members.map((member) => this.parseKey(member));
  }

  /**
   * Returns whether each member is a member of the set stored at key.
   */
  async hasMembers(...ids: ID[]) {
    return this.redis.smIsMember(
      this.key,
      ids.map((id) => this.serializeKey(id))
    );
  }

  async reset() {
    const members = await this.members();
    if (!members.length) return;
    return this.remove(...members);
  }
}
