/**
 * @file Helena values
 */

import { Script } from "./syntax";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";
import { ERROR, OK, Result, ResultCode } from "./command";

/**
 * Helena value types
 */
export enum ValueType {
  NIL,
  BOOLEAN,
  INTEGER,
  NUMBER,
  STRING,
  LIST,
  MAP,
  TUPLE,
  SCRIPT,
  QUALIFIED,
  CUSTOM,
}

/**
 * Helena value
 */
export interface Value {
  /** Type identifier */
  type: ValueType;

  /**
   * Convert to string
   *
   * Note: Name has been chosen to avoid conflicting with toString()
   */
  asString(): string;

  /** Select value at index */
  selectIndex?(index: Value): Result;

  /** Select value at key */
  selectKey?(key: Value): Result;

  /**
   * Select value with selector. When present, this takes precedence over
   * {@link selectRules}
   *
   * Note: Implementations must not call {@link Selector.apply} else this would
   * result in an infinite loop
   */
  select?(selector: Selector): Result;

  /** Select value from rules */
  selectRules?(rules: Value[]): Result;
}

/**
 * Nil value
 */
class NilValue implements Value {
  /** @override */
  readonly type = ValueType.NIL;

  /** @override */
  asString(): string {
    throw new Error("nil has no string representation");
  }
}

/** Singleton nil value */
export const NIL = new NilValue();

/**
 * Boolean value
 */
export class BooleanValue implements Value {
  /** @override */
  readonly type = ValueType.BOOLEAN;

  /** Encapsulated value */
  readonly value: boolean;

  /**
   * @param value - Value to encapsulate
   */
  constructor(value: boolean) {
    this.value = value;
  }

  /**
   * Convert Value to BooleanValue
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   *
   * @see {@link isBoolean}
   * @see {@link toBoolean}
   */
  static fromValue(value: Value): BooleanValue {
    if (value.type == ValueType.BOOLEAN) return value as BooleanValue;
    return this.toBoolean(value) ? TRUE : FALSE;
  }

  /**
   * Test if value is convertible to integer
   * - Integers
   * - Strings: any Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       True if value is convertible
   */
  static isBoolean(value: Value): boolean {
    switch (value.type) {
      case ValueType.INTEGER:
        return true;
      default: {
        const s = value.asString();
        return s == "true" || s == "false";
      }
    }
  }

  /**
   * Convert value to boolean:
   * - Booleans: use boolean value
   * - Strings: true, false
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   */
  static toBoolean(value: Value): boolean {
    if (value.type == ValueType.BOOLEAN) return (value as BooleanValue).value;
    const s = value.asString();
    if (s == "true") return true;
    if (s == "false") return false;
    throw new Error(`invalid boolean "${s}"`);
  }

  /** @override */
  asString(): string {
    return this.value.toString();
  }
}

/** Singleton true value */
export const TRUE = new BooleanValue(true);

/** Singleton false value */
export const FALSE = new BooleanValue(false);

/**
 * Integer value
 */
export class IntegerValue implements Value {
  /** @override */
  readonly type = ValueType.INTEGER;

  /** Encapsulated value */
  readonly value: number;

  /**
   * @param value - Value to encapsulate
   */
  constructor(value: number) {
    this.value = value;
  }

  /**
   * Convert Value to IntegerValue
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   *
   * @see {@link isInteger}
   * @see {@link toInteger}
   */
  static fromValue(value: Value): IntegerValue {
    if (value.type == ValueType.INTEGER) return value as IntegerValue;
    return new IntegerValue(this.toInteger(value));
  }

  /**
   * Test if value is convertible to integer
   * - Integers
   * - Strings: any Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       True if value is convertible
   */
  static isInteger(value: Value): boolean {
    switch (value.type) {
      case ValueType.INTEGER:
        return true;
      default: {
        const n = Number(value.asString());
        return !isNaN(n) && Number.isSafeInteger(n);
      }
    }
  }

  /**
   * Convert value to integer:
   * - Integers: use integer value
   * - Strings: any integer Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   */
  static toInteger(value: Value): number {
    if (value.type == ValueType.INTEGER) return (value as IntegerValue).value;
    const s = value.asString();
    const n = Number(s);
    if (isNaN(n) || !Number.isSafeInteger(n))
      throw new Error(`invalid integer "${s}"`);
    return n;
  }

  /** @override */
  asString(): string {
    return this.value.toString();
  }
}

/**
 * Number value
 */
export class NumberValue implements Value {
  /** @override */
  readonly type = ValueType.NUMBER;

  /** @override */
  readonly value: number;

  /**
   * @param value - Number value to encapsulate
   */
  constructor(value: number) {
    this.value = value;
  }

  /**
   * Convert Value to NumberValue
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   *
   * @see {@link isNumber}
   * @see {@link toNumber}
   */
  static fromValue(value: Value): NumberValue {
    if (value.type == ValueType.NUMBER) return value as NumberValue;
    return new NumberValue(this.toNumber(value));
  }

  /**
   * Test if value is convertible to number
   * - Numbers
   * - Integers
   * - Strings: any Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       True if value is convertible
   */
  static isNumber(value: Value): boolean {
    switch (value.type) {
      case ValueType.INTEGER:
      case ValueType.NUMBER:
        return true;
      default: {
        const s = value.asString();
        const n = Number(s);
        return !isNaN(n);
      }
    }
  }

  /**
   * Convert value to number:
   * - Numbers: use number value
   * - Integers: use integer value
   * - Strings: any Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   */
  static toNumber(value: Value): number {
    if (value.type == ValueType.NUMBER) return (value as NumberValue).value;
    if (value.type == ValueType.INTEGER) return (value as IntegerValue).value;
    const s = value.asString();
    const n = Number(s);
    if (isNaN(n)) throw new Error(`invalid number "${s}"`);
    return n;
  }

  /** @override */
  asString(): string {
    return this.value.toString();
  }
}

/**
 * String value
 */
export class StringValue implements Value {
  /** @override */
  readonly type = ValueType.STRING;

  /** Encapsulated value */
  readonly value: string;

  /**
   * @param value - Value to encapsulate
   */
  constructor(value: string) {
    this.value = value;
  }

  /** @override */
  asString(): string {
    return this.value;
  }

  /** @override */
  selectIndex(index: Value): Result {
    const i = IntegerValue.toInteger(index);
    if (i < 0 || i >= this.value.length) return ERROR("index out of range");
    return OK(new StringValue(this.value[i]));
  }
}

/**
 * List value
 *
 * Lists are linear collections of other values
 */
export class ListValue implements Value {
  /** @override */
  readonly type = ValueType.LIST;

  /** Encapsulated values */
  readonly values: Value[];

  /**
   * @param value - Array of values to encapsulate
   */
  constructor(value: Value[]) {
    this.values = [...value];
  }

  /** @override */
  asString(): string {
    throw new Error("value has no string representation");
  }

  /** @override */
  selectIndex(index: Value): Result {
    const i = IntegerValue.toInteger(index);
    if (i < 0 || i >= this.values.length) return ERROR("index out of range");
    return OK(this.values[i]);
  }
}

/**
 * Map value
 *
 * Map are key-value collections
 */
export class MapValue implements Value {
  /** @override */
  readonly type = ValueType.MAP;

  /** Encapsulated key-value map */
  readonly map: Map<string, Value>;

  /**
   * @param value - Key-value map to encapsulate
   */
  constructor(value: { [key: string]: Value }) {
    this.map = new Map(Object.entries(value));
  }

  /** @override */
  asString(): string {
    throw new Error("value has no string representation");
  }

  /** @override */
  selectKey(key: Value): Result {
    const k = key.asString();
    if (!this.map.has(k)) return ERROR("unknown key");
    return OK(this.map.get(k));
  }
}

/**
 * Tuple value
 *
 * Tuples are syntactic constructs in Helena. Selectors apply recursively to
 * their elements.
 */
export class TupleValue implements Value {
  /** @override */
  readonly type = ValueType.TUPLE;

  /** Encapsulated values */
  readonly values: Value[];

  /**
   * @param values - Array of values to encapsulate
   */
  constructor(values: Value[]) {
    this.values = [...values];
  }

  /** @override */
  asString(): string {
    throw new Error("value has no string representation");
  }

  /** @override */
  selectIndex(index: Value): Result {
    const values = [];
    for (const value of this.values) {
      const result = value.selectIndex(index);
      if (result.code != ResultCode.OK) return result;
      values.push(result.value);
    }
    return OK(new TupleValue(values));
  }

  /** @override */
  selectKey(key: Value): Result {
    const values = [];
    for (const value of this.values) {
      const result = value.selectKey(key);
      if (result.code != ResultCode.OK) return result;
      values.push(result.value);
    }
    return OK(new TupleValue(values));
  }

  /** @override */
  select(selector: Selector): Result {
    const values = [];
    for (const value of this.values) {
      const result = value.select
        ? value.select(selector)
        : selector.apply(value);
      if (result.code != ResultCode.OK) return result;
      values.push(result.value);
    }
    return OK(new TupleValue(values));
  }
}

/**
 * Script value
 *
 * Script values hold Helena ASTs. They are typically used to represent blocks.
 */
export class ScriptValue implements Value {
  /** @override */
  readonly type = ValueType.SCRIPT;

  /** Encapsulated script */
  readonly script: Script;

  /** Script literal value */
  readonly value: string;

  /**
   * @param script - Script to encapsulate
   * @param value  - Script literal value
   */
  constructor(script: Script, value: string) {
    this.script = script;
    this.value = value;
  }

  /** @override */
  asString(): string {
    return this.value;
  }
}

/**
 * Qualified value
 *
 * Qualified values are syntactic constructs in Helena. Selectors build a new
 * qualified value with the selector appended.
 */
export class QualifiedValue implements Value {
  /** @override */
  readonly type = ValueType.QUALIFIED;

  /** Source */
  readonly source: Value;

  /** Selectors */
  readonly selectors: Selector[];

  /**
   * @param source    - Source
   * @param selectors - Selectors
   */
  constructor(source: Value, selectors: Selector[]) {
    this.source = source;
    this.selectors = selectors;
  }

  /** @override */
  asString(): string {
    throw new Error("value has no string representation");
  }

  /** @override */
  selectIndex(index: Value): Result {
    return this.select(new IndexedSelector(index));
  }

  /** @override */
  selectKey(key: Value): Result {
    if (
      this.selectors.length > 0 &&
      this.selectors[this.selectors.length - 1] instanceof KeyedSelector
    ) {
      // Merge successive keys
      const last = this.selectors[this.selectors.length - 1] as KeyedSelector;
      return OK(
        new QualifiedValue(this.source, [
          ...this.selectors.slice(0, -1),
          new KeyedSelector([...last.keys, key]),
        ])
      );
    }
    return this.select(new KeyedSelector([key]));
  }

  /** @override */
  selectRules(rules: Value[]): Result {
    return this.select(new GenericSelector(rules));
  }

  /** @override */
  select(selector: Selector): Result {
    return OK(new QualifiedValue(this.source, [...this.selectors, selector]));
  }
}
