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
  selectIndex(index: Value): Value;

  /** Select value at key */
  selectKey(key: Value): Value;

  /** Select value from rules */
  selectRules(rules: Value[]): Value;

  /** Select value with selector */
  select?(selector: Selector): Value;
}

/**
 * Nil value
 */
class NilValue implements Value {
  /** @override */
  type = ValueType.NIL;

  /** @override */
  asString(): string {
    throw new Error("nil has no string representation");
  }

  /** @override */
  selectIndex(_index: Value): Value {
    throw new Error("nil is not index-selectable");
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("nil is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("nil is not selectable");
  }
}

/** Singleton nil value */
export const NIL = new NilValue();

/**
 * Boolean value
 */
export class BooleanValue implements Value {
  /** @override */
  type = ValueType.BOOLEAN;

  /** Encapsulated value */
  value: boolean;

  /**
   * @param value - Value to encapsulate
   */
  constructor(value: boolean) {
    this.value = value;
  }

  /**
   * Convert value to boolean:
   * - Integers: C semantics (non-zero = true, zero = false)
   * - Strings: true/yes/1 = true, false/no/0 = false
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   */
  static fromValue(value: Value): BooleanValue {
    switch (value.type) {
      case ValueType.BOOLEAN:
        return value as BooleanValue;
      case ValueType.INTEGER:
        return (value as IntegerValue).value ? TRUE : FALSE;
    }
    const s = value.asString();
    if (s == "true" || s == "yes" || s == "1") return TRUE;
    if (s == "false" || s == "no" || s == "0") return FALSE;
    const i = parseInt(s);
    if (isNaN(i)) throw new Error(`invalid boolean "${s}"`);
    return i ? TRUE : FALSE;
  }

  /** @override */
  asString(): string {
    return this.value.toString();
  }

  /** @override */
  selectIndex(_index: Value): Value {
    throw new Error("value is not index-selectable");
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("value is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
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
  type = ValueType.INTEGER;

  /** Encapsulated value */
  value: number;

  /**
   * @param value - Value to encapsulate
   */
  constructor(value: number) {
    this.value = value;
  }

  /**
   * Convert value to integer:
   * - Strings: any parseInt-accepted integer string
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   */
  static fromValue(value: Value): IntegerValue {
    if (value.type == ValueType.INTEGER) return value as IntegerValue;
    const s = value.asString();
    const i = parseInt(s);
    if (isNaN(i)) throw new Error(`invalid integer "${s}"`);
    return new IntegerValue(i);
  }

  /** @override */
  asString(): string {
    return this.value.toString();
  }

  /** @override */
  selectIndex(_index: Value): Value {
    throw new Error("value is not index-selectable");
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("value is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

/**
 * Number value
 */
export class NumberValue implements Value {
  /** @override */
  type = ValueType.NUMBER;

  /** @override */
  value: number;

  /**
   * @param value - Number value to encapsulate
   */
  constructor(value: number) {
    this.value = value;
  }

  /**
   * Convert value to number:
   * - Strings: any parseFloat-accepted number string
   *
   * @param value - Value to convert
   *
   * @returns       Converted value
   */
  static fromValue(value: Value): NumberValue {
    if (value.type == ValueType.NUMBER) return value as NumberValue;
    const s = value.asString();
    const n = parseFloat(s);
    if (isNaN(n)) throw new Error(`invalid number "${s}"`);
    return new NumberValue(n);
  }

  /** @override */
  asString(): string {
    return this.value.toString();
  }

  /** @override */
  selectIndex(_index: Value): Value {
    throw new Error("value is not index-selectable");
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("value is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

/**
 * String value
 */
export class StringValue implements Value {
  /** @override */
  type = ValueType.STRING;

  /** Encapsulated value */
  value: string;

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
  selectIndex(index: Value): Value {
    const i = IntegerValue.fromValue(index).value;
    if (i < 0 || i >= this.value.length) throw new Error("index out of range");
    return new StringValue(this.value[i]);
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("value is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

/**
 * List value
 *
 * Lists are linear collections of other values
 */
export class ListValue implements Value {
  /** @override */
  type = ValueType.LIST;

  /** Encapsulated values */
  values: Value[];

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
  selectIndex(index: Value): Value {
    const i = IntegerValue.fromValue(index).value;
    if (i < 0 || i >= this.values.length) throw new Error("index out of range");
    return this.values[i];
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("value is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

/**
 * Map value
 *
 * Map are key-value collections
 */
export class MapValue implements Value {
  /** @override */
  type = ValueType.MAP;

  /** Encapsulated key-value map */
  map: Map<string, Value>;

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
  selectIndex(_index: Value): Value {
    throw new Error("value is not index-selectable");
  }

  /** @override */
  selectKey(key: Value): Value {
    const k = key.asString();
    if (!this.map.has(k)) throw new Error("unknown key");
    return this.map.get(k);
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
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
  type = ValueType.TUPLE;

  /** Encapsulated values */
  values: Value[];

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
  selectIndex(index: Value): Value {
    return new TupleValue(this.values.map((value) => value.selectIndex(index)));
  }

  /** @override */
  selectKey(key: Value): Value {
    return new TupleValue(this.values.map((value) => value.selectKey(key)));
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
  }

  /** @override */
  select(selector: Selector): Value {
    return new TupleValue(this.values.map((value) => selector.apply(value)));
  }
}

/**
 * Script value
 *
 * Script values hold Helena ASTs. They are typically used to represent blocks.
 */
export class ScriptValue implements Value {
  /** @override */
  type = ValueType.SCRIPT;

  /** Encapsulated script */
  script: Script;

  /** Script literal value */
  value: string;

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

  /** @override */
  selectIndex(_index: Value): Value {
    throw new Error("value is not index-selectable");
  }

  /** @override */
  selectKey(_key: Value): Value {
    throw new Error("value is not key-selectable");
  }

  /** @override */
  selectRules(_rules: Value[]): Value {
    throw new Error("value is not selectable");
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
  type = ValueType.QUALIFIED;

  /** Source */
  source: Value;

  /** Selectors */
  selectors: Selector[];

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
  selectIndex(index: Value): Value {
    return this.select(new IndexedSelector(index));
  }

  /** @override */
  selectKey(key: Value): Value {
    if (
      this.selectors.length > 0 &&
      this.selectors[this.selectors.length - 1] instanceof KeyedSelector
    ) {
      // Merge successive keys
      const last = this.selectors[this.selectors.length - 1] as KeyedSelector;
      return new QualifiedValue(this.source, [
        ...this.selectors.slice(0, -1),
        new KeyedSelector([...last.keys, key]),
      ]);
    }
    return this.select(new KeyedSelector([key]));
  }

  /** @override */
  selectRules(rules: Value[]): Value {
    return this.select(new GenericSelector(rules));
  }

  /** @override */
  select(selector: Selector): Value {
    return new QualifiedValue(this.source, [...this.selectors, selector]);
  }
}
