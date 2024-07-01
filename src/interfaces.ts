import type { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

export type RedisKeygen<ID> = {
  parse: (key: string) => ID;
  serialize: (id: ID) => string;
};

export const DEFAULT_KEYGEN: RedisKeygen<any> = {
  parse: (key: string) => key as any,
  serialize: (id: unknown) => {
    if (typeof id === 'string') return id;
    throw new Error(
      `Could not serialize Redis ID of type ${typeof id} to valid redis key.`
    );
  },
};
