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
import { ERROR, OK, ResultCode, Result } from "./results";
import {
  defaultDisplayFunction,
  Displayable,
  DisplayFunction,
  displayLiteralOrBlock,
  displayLiteralOrString,
  displayList,
  undisplayableValue,
  display,
} from "./display";

/** Helena standard value types */
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
}

/** Helena custom value types */
export interface CustomValueType {
  /** Custom value name */
  readonly name: string;
}

/**
 * Helena value
 */
export interface Value extends Displayable {
  /** Type identifier */
  readonly type: ValueType | CustomValueType;

  /**
   * Convert to string
   *
   * Note: Name has been chosen to avoid conflicting with toString()
   */
  asString?(): string;

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
  display(): string {
    return "[]";
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
   * @returns       Conversion result
   */
  static fromValue(value: Value): Result<BooleanValue> {
    if (value.type == ValueType.BOOLEAN)
      return OK(value, value as BooleanValue);
    const { data, ...result } = this.toBoolean(value);
    if (result.code != ResultCode.OK) return result;
    const v = data ? TRUE : FALSE;
    return OK(v, v);
  }

  /**
   * Convert value to boolean:
   * - Booleans: use boolean value
   * - Strings: true, false
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static toBoolean(value: Value): Result<boolean> {
    if (value.type == ValueType.BOOLEAN)
      return OK(NIL, (value as BooleanValue).value);
    const { data: s, ...result } = StringValue.toString(value);
    if (result.code != ResultCode.OK) return result;
    if (s == "true") return OK(NIL, true);
    if (s == "false") return OK(NIL, false);
    return ERROR(`invalid boolean "${s}"`);
  }

  /** @override */
  display(): string {
    return this.value ? "true" : "false";
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
   * @returns       Conversion result
   */
  static fromValue(value: Value): Result<IntegerValue> {
    if (value.type == ValueType.INTEGER)
      return OK(value, value as IntegerValue);
    const { data, ...result } = this.toInteger(value);
    if (result.code != ResultCode.OK) return result;
    const v = new IntegerValue(data);
    return OK(v, v);
  }

  /**
   * Convert value to integer:
   * - Integers: use integer value
   * - Strings: any integer Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static toInteger(value: Value): Result<number> {
    if (value.type == ValueType.INTEGER)
      return OK(NIL, (value as IntegerValue).value);
    const { data: s, ...result } = StringValue.toString(value);
    if (result.code != ResultCode.OK) return result;
    const n = Number(s);
    if (isNaN(n)) return ERROR(`invalid integer "${s}"`);
    return OK(NIL, n);
  }

  /** @override */
  display(): string {
    return this.asString();
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
   */
  static fromValue(value: Value): Result<NumberValue> {
    if (value.type == ValueType.NUMBER) return OK(value, value as NumberValue);
    if (value.type == ValueType.INTEGER) {
      const v = new NumberValue((value as IntegerValue).value);
      return OK(v, v);
    }
    const { data, ...result } = this.toNumber(value);
    if (result.code != ResultCode.OK) return result;
    const v = new NumberValue(data);
    return OK(v, v);
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
        return !isNaN(Number(value.asString?.()));
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
   * @returns       Conversion result
   */
  static toNumber(value: Value): Result<number> {
    if (value.type == ValueType.NUMBER)
      return OK(NIL, (value as NumberValue).value);
    if (value.type == ValueType.INTEGER)
      return OK(NIL, (value as IntegerValue).value);
    const { data: s, ...result } = StringValue.toString(value);
    if (result.code != ResultCode.OK) return result;
    const n = Number(s);
    if (isNaN(n)) return ERROR(`invalid number "${s}"`);
    return OK(NIL, n);
  }

  /** @override */
  display(): string {
    return this.asString();
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

  /**
   * Convert Value to StringValue
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static fromValue(value: Value): Result<StringValue> {
    if (value.type == ValueType.STRING) return OK(value, value as StringValue);
    const str = value.asString?.();
    if (str == null) return ERROR("value has no string representation");
    const s = new StringValue(str);
    return OK(s, s);
  }

  /**
   * Convert value to string
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static toString(value: Value): Result<string> {
    const str = value.asString?.();
    if (str == null) return ERROR("value has no string representation");
    return OK(NIL, str);
  }

  /**
   * Get character as StringValue
   *
   * @param value - String to access
   * @param index - Index of character to access
   * @param [def] - Default value for out-of-range index
   *
   * @returns       Conversion result
   */
  static at(value: string, index: Value, def?: Value): Result {
    const result = IntegerValue.toInteger(index);
    if (result.code != ResultCode.OK) return result;
    const i = result.data as number;
    if (i < 0 || i >= value.length)
      return def ? OK(def) : ERROR(`index out of range "${i}"`);
    return OK(new StringValue(value[i]));
  }

  /** @override */
  display(): string {
    return displayLiteralOrString(this.value);
  }

  /** @override */
  asString(): string {
    return this.value;
  }

  /** @override */
  selectIndex(index: Value): Result {
    return StringValue.at(this.value, index);
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

  /**
   * Convert Value to ListValue
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static fromValue(value: Value): Result<ListValue> {
    if (value.type == ValueType.LIST) return OK(value, value as ListValue);
    const { data, ...result } = this.toValues(value);
    if (result.code != ResultCode.OK) return result;
    const v = new ListValue(data);
    return OK(v, v);
  }

  /**
   * Convert value to array of values:
   * - Lists
   * - Tuples
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static toValues(value: Value): Result<Value[]> {
    switch (value.type) {
      case ValueType.LIST:
        return OK(NIL, (value as ListValue).values);
      case ValueType.TUPLE:
        return OK(NIL, (value as TupleValue).values);
      default:
        return ERROR("invalid list");
    }
  }

  /**
   * Get element
   *
   * @param values - Values to access
   * @param index  - Index of element to access
   * @param [def]  - Default value for out-of-range index
   *
   * @returns        Conversion result
   */
  static at(values: Value[], index: Value, def?: Value): Result {
    const result = IntegerValue.toInteger(index);
    if (result.code != ResultCode.OK) return result;
    const i = result.data as number;
    if (i < 0 || i >= values.length)
      return def ? OK(def) : ERROR(`index out of range "${i}"`);
    return OK(values[i]);
  }

  /** @override */
  selectIndex(index: Value): Result {
    return ListValue.at(this.values, index);
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
  constructor(value: { [key: string]: Value } | Map<string, Value>) {
    this.map = new Map(value instanceof Map ? value : Object.entries(value));
  }

  /** @override */
  selectKey(key: Value): Result {
    const k = key.asString?.();
    if (k == null) return ERROR("invalid key");
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
  selectIndex(index: Value): Result {
    const values = [];
    for (const value of this.values) {
      if (!value.selectIndex) return ERROR("value is not index-selectable");
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
      if (!value.selectKey) return ERROR("value is not key-selectable");
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

  /** @override */
  display(fn = defaultDisplayFunction): string {
    return `(${displayList(this.values, fn)})`;
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

  /** Script source string */
  readonly source: string;

  /**
   * @param script - Script to encapsulate
   * @param source - Script source string
   */
  constructor(script: Script, source: string) {
    this.script = script;
    this.source = source;
  }

  /** @override */
  display(
    fn: DisplayFunction = () => undisplayableValue("undisplayable script")
  ): string {
    if (this.source == null) return fn(this);
    return `{${this.source}}`;
  }

  /** @override */
  asString(): string {
    return this.source;
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
  display(fn = defaultDisplayFunction): string {
    return (
      (this.source.type == ValueType.TUPLE
        ? this.source.display(fn)
        : displayLiteralOrBlock(this.source.asString?.())) +
      this.selectors.map((selector) => display(selector, fn)).join("")
    );
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

/*
 * Type predicates
 *
 * See https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 */

/**
 * Type predicate for Value
 *
 * @param value - Object to test
 * @returns       Whether value is a Value
 */
export function isValue(value: Displayable): value is Value {
  return !!value["type"];
}

/**
 * Type predicate for CustomValueType
 *
 * @param type - Type to test
 * @returns      Whether type is a CustomValueType
 */
export function isCustomValueType(
  type: ValueType | CustomValueType
): type is CustomValueType {
  return !!type["name"];
}

/*
 * Convenience functions for primitive value creation
 */

/* eslint-disable jsdoc/require-jsdoc */
export const BOOL = (v) => (v ? TRUE : FALSE);
export const INT = (v) => new IntegerValue(v);
export const NUM = (v) => new NumberValue(v);
export const STR = (v) => new StringValue(v);
export const LIST = (v) => new ListValue(v);
export const MAP = (v) => new MapValue(v);
export const TUPLE = (v) => new TupleValue(v);
/* eslint-enable jsdoc/require-jsdoc */
