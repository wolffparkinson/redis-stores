# redis-stores

## Table of contents

- [Installation](#installation)
- [Usage](#usage)
- [Stores](#stores)

## Installation

```sh
# via npm
npm install redis-stores

# using yarn
yarn add redis-stores

# using pnpm
pnpm add redis-stores
```

## Usage

```ts
import { ObjectStore } from "redis-stores";
import { createClient } from "redis";

const client = createClient({ url: "redis://localhost:6379" });

type User = {
  id: string;
  name: string;
};

const store = new ObjectStore<User>({ client, prefix: "user" });

const user: User = {
  id: "1",
  name: "user1",
};

// Type safe
await store.set(user.id, user);

// Type safe
const result = await store.get(user.id);
// result is of type User
```

## Stores

- String based
  - Object store : Store objects serialized as string.
  - Number store : Store numbers serialized as string.
  - String store : Store strings in key-value store
- JSON store : Store objects in native RedisJSON format. `@redis/json`
- Redis set : Store a collection of IDs
