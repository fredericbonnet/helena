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
import { Command } from "./commands";
import { Program } from "./compiler";

/** Helena standard value types */
export enum ValueType {
  NIL,
  BOOLEAN,
  INTEGER,
  REAL,
  STRING,
  LIST,
  DICTIONARY,
  TUPLE,
  SCRIPT,
  COMMAND,
  QUALIFIED,
  CUSTOM,
}

/**
 * Helena value
 */
export interface Value extends Displayable {
  /** Type identifier */
  readonly type: ValueType;

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
 * Apply a selector to a value
 *
 * @param value    - Value to select
 * @param selector - Selector to apply
 *
 * @returns          Selected subvalue
 */
export function applySelector(value: Value, selector: Selector): Result {
  return value.select ? value.select(selector) : selector.apply(value);
}

/**
 * Select value with either {@link Value.select} or {@link Value.selectRules} in
 * this order of precedence.
 *
 * @param value    - Value to select
 * @param selector - Selector to apply
 *
 * @returns          Selected value
 */
export function selectGeneric(value: Value, selector: GenericSelector): Result {
  if (!value.select && !value.selectRules)
    return ERROR("value is not selectable");
  return value.select
    ? value.select(selector)
    : value.selectRules(selector.rules);
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
  static fromValue(value: Value): [Result, BooleanValue?] {
    if (value.type == ValueType.BOOLEAN)
      return [OK(value), value as BooleanValue];
    const [result, b] = this.toBoolean(value);
    if (result.code != ResultCode.OK) return [result];
    const v = b ? TRUE : FALSE;
    return [OK(v), v];
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
  static toBoolean(value: Value): [Result, boolean?] {
    if (value.type == ValueType.BOOLEAN)
      return [OK(NIL), (value as BooleanValue).value];
    const [result, s] = StringValue.toString(value);
    if (result.code != ResultCode.OK) return [result];
    if (s == "true") return [OK(NIL), true];
    if (s == "false") return [OK(NIL), false];
    return [ERROR(`invalid boolean "${s}"`)];
  }

  /** @override */
  display(): string {
    return this.value ? "true" : "false";
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
  static fromValue(value: Value): [Result, IntegerValue?] {
    if (value.type == ValueType.INTEGER)
      return [OK(value), value as IntegerValue];
    const [result, i] = this.toInteger(value);
    if (result.code != ResultCode.OK) return [result];
    const v = new IntegerValue(i);
    return [OK(v), v];
  }

  /**
   * Test if string is convertible to integer
   *
   * @param value - String to convert
   *
   * @returns       True if value is convertible
   */
  static isInteger(value: string): boolean {
    const n = Number(value);
    return !isNaN(n) && Number.isSafeInteger(n);
  }

  /**
   * Convert value to integer:
   * - Integers: use integer value
   * - Reals: any safe integer number
   * - Strings: any integer Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static toInteger(value: Value): [Result, number?] {
    if (value.type == ValueType.INTEGER)
      return [OK(NIL), (value as IntegerValue).value];
    if (value.type == ValueType.REAL) {
      if (!Number.isSafeInteger((value as RealValue).value))
        return [ERROR(`invalid integer "${(value as RealValue).value}"`)];
      return [OK(NIL), (value as RealValue).value];
    }
    const [result, s] = StringValue.toString(value);
    if (result.code != ResultCode.OK) return [result];
    const n = Number(s);
    if (isNaN(n) || !Number.isSafeInteger(n))
      return [ERROR(`invalid integer "${s}"`)];
    return [OK(NIL), n];
  }

  /** @override */
  display(): string {
    return this.value.toString();
  }
}

/**
 * Real value
 */
export class RealValue implements Value {
  /** @override */
  readonly type = ValueType.REAL;

  /** Encapsulated value */
  readonly value: number;

  /**
   * @param value - Number value to encapsulate
   */
  constructor(value: number) {
    this.value = value;
  }

  /**
   * Convert Value to RealValue
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   *
   * @see {@link toNumber}
   */
  static fromValue(value: Value): [Result, RealValue?] {
    if (value.type == ValueType.REAL) return [OK(value), value as RealValue];
    if (value.type == ValueType.INTEGER) {
      const v = new RealValue((value as IntegerValue).value);
      return [OK(v), v];
    }
    const [result, n] = this.toNumber(value);
    if (result.code != ResultCode.OK) return [result];
    const v = new RealValue(n);
    return [OK(v), v];
  }

  /**
   * Test if string value is convertible to number
   *
   * @param value - String to convert
   *
   * @returns       True if value is convertible
   */
  static isNumber(value: string): boolean {
    return !isNaN(Number(value));
  }

  /**
   * Convert value to number:
   * - Reals and integers: use number value
   * - Strings: any Number()-accepted string
   *
   * @param value - Value to convert
   *
   * @returns       Conversion result
   */
  static toNumber(value: Value): [Result, number?] {
    if (value.type == ValueType.REAL)
      return [OK(NIL), (value as RealValue).value];
    if (value.type == ValueType.INTEGER)
      return [OK(NIL), (value as IntegerValue).value];
    const [result, s] = StringValue.toString(value);
    if (result.code != ResultCode.OK) return [result];
    const n = Number(s);
    if (isNaN(n)) return [ERROR(`invalid number "${s}"`)];
    return [OK(NIL), n];
  }

  /** @override */
  display(): string {
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
  static fromValue(value: Value): [Result, StringValue?] {
    if (value.type == ValueType.STRING)
      return [OK(value), value as StringValue];
    const [result, s] = this.toString(value);
    if (result.code != ResultCode.OK) return [result];
    const v = new StringValue(s);
    return [OK(v), v];
  }

  /**
   * Convert value to string
   *
   * @param value - Value to convert
   * @param [def] - Default result if value has no string representation
   *
   * @returns       Conversion result
   */
  static toString(value: Value, def?: string): [Result, string?] {
    switch (value.type) {
      case ValueType.STRING:
        return [OK(NIL), (value as StringValue).value];
      case ValueType.BOOLEAN:
        return [OK(NIL), (value as BooleanValue).value.toString()];
      case ValueType.INTEGER:
        return [OK(NIL), (value as IntegerValue).value.toString()];
      case ValueType.REAL:
        return [OK(NIL), (value as RealValue).value.toString()];
      case ValueType.SCRIPT: {
        const source = (value as ScriptValue).source;
        if (source != undefined && source != null) return [OK(NIL), source];
      }
    }
    if (def) return [OK(NIL), def];
    return [ERROR("value has no string representation")];
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
    const [result, i] = IntegerValue.toInteger(index);
    if (result.code != ResultCode.OK) return result;
    if (i < 0 || i >= value.length)
      return def ? OK(def) : ERROR(`index out of range "${i}"`);
    return OK(new StringValue(value[i]));
  }

  /** @override */
  display(): string {
    return displayLiteralOrString(this.value);
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
  static fromValue(value: Value): [Result, ListValue?] {
    if (value.type == ValueType.LIST) return [OK(value), value as ListValue];
    const [result, l] = this.toValues(value);
    if (result.code != ResultCode.OK) return [result];
    const v = new ListValue(l);
    return [OK(v), v];
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
  static toValues(value: Value): [Result, Value[]?] {
    switch (value.type) {
      case ValueType.LIST:
        return [OK(NIL), (value as ListValue).values];
      case ValueType.TUPLE:
        return [OK(NIL), (value as TupleValue).values];
      default:
        return [ERROR("invalid list")];
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
    const [result, i] = IntegerValue.toInteger(index);
    if (result.code != ResultCode.OK) return result;
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
 * Dictionary value
 *
 * Dictionaries are key-value collections with string keys
 */
export class DictionaryValue implements Value {
  /** @override */
  readonly type = ValueType.DICTIONARY;

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
    const [result, s] = StringValue.toString(key);
    if (result.code != ResultCode.OK) return ERROR("invalid key");
    if (!this.map.has(s)) return ERROR("unknown key");
    return OK(this.map.get(s));
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
      const result = applySelector(value, selector);
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
  readonly source?: string;

  /**
   * @param script - Script to encapsulate
   * @param source - Script source string
   */
  constructor(script: Script, source?: string) {
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

  /** Run-time cache */
  readonly cache: ScriptValueCache = new ScriptValueCache();
}
/** Run-time caching structure for script values */
class ScriptValueCache {
  /** Cached compiled program */
  program?: Program;

  /** Cached array of values */
  values?: 	Value[];
}

/**
 * Command value
 *
 * Command values encapsulate commands. They cannot be created directly from
 * source.
 */
export class CommandValue implements Value {
  /** @override */
  readonly type = ValueType.COMMAND;

  /** Encapsulated command */
  readonly command: Command;

  /**
   * @param command - Command to encapsulate
   */
  constructor(command: Command) {
    this.command = command;
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
    let source;
    if (this.source.type == ValueType.TUPLE) {
      source = this.source.display(fn);
    } else {
      const [result, s] = StringValue.toString(this.source);
      source =
        result.code == ResultCode.OK
          ? displayLiteralOrBlock(s)
          : undisplayableValue("source");
    }
    return (
      source + this.selectors.map((selector) => display(selector, fn)).join("")
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

/** Custom value type */
export interface CustomValueType {
  /** Custom value name */
  readonly name: string;
}

/**
 * Custom values
 */
export interface CustomValue extends Value {
  /** Custom type info */
  customType: CustomValueType;
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
  return !!value["type"] && value["type"] in ValueType;
}

/**
 * Type predicate for CustomValue
 *
 * @param value      - Object to test
 * @param customType - Custom value type to match
 * @returns            Whether value is a custom value of the given type
 */
export function isCustomValue(
  value: Value,
  customType: CustomValueType
): value is CustomValue {
  return (
    value.type == ValueType.CUSTOM &&
    (value as CustomValue).customType == customType
  );
}

/*
 * Convenience functions for primitive value creation
 */

/* eslint-disable jsdoc/require-jsdoc */
export const BOOL = (v) => (v ? TRUE : FALSE);
export const INT = (v) => new IntegerValue(v);
export const REAL = (v) => new RealValue(v);
export const STR = (v) => new StringValue(v);
export const LIST = (v) => new ListValue(v);
export const DICT = (v) => new DictionaryValue(v);
export const TUPLE = (v) => new TupleValue(v);
/* eslint-enable jsdoc/require-jsdoc */
