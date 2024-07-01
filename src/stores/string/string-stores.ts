import { BaseStringStore } from './base-string.store';
import {
  booleanParser,
  numberParser,
  objectParser,
  stringParser,
} from './string-parsers';

export class StringStore<ID = string> extends BaseStringStore<string, ID> {
  valueParser = stringParser;
}

export class NumberStore<ID = string> extends BaseStringStore<number, ID> {
  valueParser = numberParser;
}

export class BooleanStore<ID = string> extends BaseStringStore<boolean, ID> {
  valueParser = booleanParser;
}

export class ObjectStore<T, ID = string> extends BaseStringStore<T, ID> {
  valueParser = objectParser<T>();
}
