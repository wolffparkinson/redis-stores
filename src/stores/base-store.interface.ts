import { RedisKeygen } from "../interfaces";

type RedisStoreBaseOptions = {
  separator?: string;
  prefix: string;
  ttl?: number;
};

export type RedisStoreOptions<ID = string> = ID extends string
  ? RedisStoreBaseOptions & { keygen?: RedisKeygen<ID> }
  : RedisStoreBaseOptions & { keygen: RedisKeygen<ID> };
