import type { transformArguments as createCommandArgs } from '@redis/search/dist/commands/CREATE';
import { RediSearchSchema, SchemaFieldTypes, SearchOptions } from 'redis';
import { Mapped } from '../../utils';
import { RedisClient } from '../../interfaces';

type CreateIndexOptions = Parameters<typeof createCommandArgs>[2];
export type JsonSearchSchema = Record<
  string,
  RediSearchSchema[keyof RediSearchSchema] & { path: string }
>;

type Logger = {
  log: (message: any) => void;
  debug: (message: any) => void;
  error: (message: any) => void;
};

interface JsonSearchStoreOptions {
  name: string;
  client: RedisClient;
  schema: JsonSearchSchema;
  prefix?: string | string[];
  logger?: Logger;
}

export class JsonSearchStore<Doc, Schema extends JsonSearchSchema> {
  private readonly redis: RedisClient;
  private readonly INDEX: string;
  private readonly schema: RediSearchSchema;
  private readonly createOptions: CreateIndexOptions;
  private readonly logger?: Logger;

  constructor(private readonly options: JsonSearchStoreOptions) {
    this.redis = options.client;
    this.INDEX = options.name;
    this.logger = options.logger;

    this.schema = Object.fromEntries(
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-expect-error
      Object.entries(options.schema).map(([k, { path, ...v }]) => [
        path,
        { ...v, AS: k },
      ])
    );

    this.createOptions = {
      ON: 'JSON',
      PREFIX: options.prefix
        ? Array.isArray(options.prefix)
          ? options.prefix
          : [options.prefix]
        : undefined,
    };
  }

  async init() {
    const idxList = await this.redis.ft._list();
    if (idxList.includes(this.INDEX)) {
      if (await this.hasIndexChanged()) {
        this.logger?.debug(`Index has changed. Recreating ${this.INDEX}`);
        await this.redis.ft.dropIndex(this.INDEX);
      } else return;
    }

    await this.redis.ft.create(this.INDEX, this.schema, this.createOptions);
  }

  private async hasIndexChanged() {
    const rawInfo = await this.redis.ft.info(this.INDEX);

    const schema = new Map(Object.entries(this.schema));
    const attributes = new Map(
      Object.values(rawInfo.attributes).map((a) => [a['identifier'], a])
    );
    const definition = new Map(Object.entries(rawInfo.indexDefinition));

    // Attribute changes
    if (schema.size !== attributes.size) return true;
    for (const [identifier, props] of schema) {
      const attribute = attributes.get(identifier);
      if (!attribute) return true;
      for (const [propKey, propValue] of Object.entries(props)) {
        const attrKey = attrMappings.find(
          (attr) => attr.key === propKey
        )?.infoKey;
        if (!attrKey) {
          throw new Error(`Index schema key not mapped : ${propKey}`);
        }
        if (propValue !== attribute[attrKey]) return true;
      }
    }

    // Definition changes
    for (const [key, value] of Object.entries(this.createOptions ?? {})) {
      const defKey = defMappings.find((attr) => attr.key === key);
      if (!defKey) {
        throw new Error(`Index definition key not mapped : ${key}`);
      }

      if (!defKey.compare(value, definition.get(defKey.infoKey))) return true;
    }

    return false;
  }

  async rawQuery(query: string, options?: SearchOptions) {
    return this.redis.ft.search(this.INDEX, query, options);
  }

  private buildQuery(where: any) {
    const q = [];
    for (const key in where) {
      switch (key) {
        case 'AND':
          q.push(
            `(${where[key].map((q: any) => this.buildQuery(q)).join(' ')})`
          );
          break;
        case 'OR':
          if (!where[key].length)
            throw new Error('More than one condition required for OR');
          q.push(
            `(${where[key].map((q: any) => this.buildQuery(q)).join(' | ')})`
          );
          break;
        default:
          {
            let value = where[key];

            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-expect-error
            if (this.options.schema[key]?.type === SchemaFieldTypes.TAG) {
              value = `{${value}}`;
            }

            q.push(`(@${key}:${value})`);
          }
          break;
      }
    }

    return q.join(' ');
  }

  // TODO: Use INFIELDS paramerter in Redis search
  async query(options: QueryOptions<Doc, Schema>): Promise<Doc[]> {
    function addWildcard(text: string) {
      if (options.wildcard === false) return text.trim();
      return `*${text.trim().replace(/ /gm, '*')}*`;
    }

    const AND = [];
    if (options.where) AND.push(this.buildQuery(options.where));

    if (options.search) {
      if (typeof options.search === 'string') {
        AND.push(`(${addWildcard(options.search)})`);
      } else if (Array.isArray(options.search)) {
        const search = options.search[0];
        AND.push(
          `(${options.search[1]
            .map((k) => `(@${String(k)}:${addWildcard(search)})`)
            .join(' | ')})`
        );
      } else {
        throw new Error(`Unsupported search type: ${typeof options.search}`);
      }
    }

    if (!AND.length) return [];
    const query = AND.join(' ');
    this.logger?.debug({ query });

    const { documents } = await this.rawQuery(query, {
      LIMIT: options.limit ? { from: 0, size: options.limit } : undefined,
    });
    if (!documents.length) return [];
    return documents.map((d) => d.value as any);
  }
}

const attrMappings = [
  {
    key: 'type',
    infoKey: 'type',
  },
  {
    key: 'AS',
    infoKey: 'attribute',
  },
];

const defMappings = [
  {
    key: 'ON',
    infoKey: 'key_type',
    compare: (value: any, defValue: any) => value === defValue,
  },
  {
    key: 'PREFIX',
    infoKey: 'prefixes',
    compare: (value: any, defValue: any) => {
      value = Array.isArray(value) ? value : [value];
      return (
        value.length === defValue.length &&
        value.every((v: string) => defValue.includes(v))
      );
    },
  },
];

export type WhereOptions<T> = {
  [K in keyof T]: T[K] extends string[] ? T[K][number] : T[K];
};

type WhereInput<T> = Partial<WhereOptions<T>> & {
  AND?: WhereInput<T> | WhereInput<T>[];
  OR?: WhereInput<T>[];
};

type QueryOptions<D, S, M = Mapped<D, S>> = {
  search?: string | [string, (keyof M)[]];
  where?: WhereInput<M>;
  limit?: number;
  wildcard?: false;
};
