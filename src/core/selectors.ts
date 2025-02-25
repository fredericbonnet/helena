/**
 * @file Helena value selectors
 */

import { ERROR, OK, Result, ResultCode } from "./results";
import { NIL, TupleValue, Value, ValueType, selectGeneric } from "./values";
import { defaultDisplayFunction, Displayable, displayList } from "./display";

/**
 * Generic selector creation error
 */
export class SelectorCreationError extends Error {
  /**
   *
   * @param message - Error message
   */
  constructor(message) {
    super(message);
    this.name = "SelectorCreationError";
  }
}

/**
 * Thrown when creating an indexed selector with an invalid index
 */
export class InvalidIndexError extends SelectorCreationError {
  /**
   *
   * @param message - Error message
   */
  constructor(message) {
    super(message);
    this.name = "InvalidIndexError";
  }
}

/**
 * Thrown when creating a keyed selector with no keys, or a generic selector
 * with no rules.
 */
export class EmptySelectorError extends SelectorCreationError {
  /**
   *
   * @param message - Error message
   */
  constructor(message) {
    super(message);
    this.name = "EmptySelectorError";
  }
}

/**
 * Helena selector
 *
 * Selectors apply to values to access their subvalues
 */
export interface Selector extends Displayable {
  /**
   * Apply selector to given value
   *
   * @param value - Target value
   *
   * @returns       Selected subvalue
   */
  apply(value: Value): Result;
}

/**
 * Indexed selector
 *
 * Indexed selectors delegate to {@link Value.selectIndex}. They typically apply
 * to linear collections with integer indexes, though Helena makes no assumption
 * on the actual type of the index value. For example a 2D matrix value could
 * accept a pair of (column, row) integers to select one of its cells.
 */
export class IndexedSelector implements Selector {
  /** Index to select */
  readonly index: Value;

  /**
   * @param index - Index to select
   */
  constructor(index: Value) {
    if (index == NIL) throw new InvalidIndexError("invalid index");
    this.index = index;
  }

  /**
   * Factory function, returns a result instead of throwing.
   *
   * @param index - Index to select
   *
   * @returns       New selector or error
   */
  static create(index: Value): [Result, Selector?] {
    if (index == NIL) return [ERROR("invalid index")];
    return [OK(NIL), new IndexedSelector(index)];
  }

  /** @override */
  apply(value: Value): Result {
    if (!value.selectIndex) return ERROR("value is not index-selectable");
    return value.selectIndex(this.index);
  }

  /** @override */
  display(fn = defaultDisplayFunction): string {
    return `[${this.index.display(fn)}]`;
  }
}

/**
 * Keyed selector
 *
 * Keyed selectors delegate to {@link Value.selectKey}. They typically apply
 * to key-value collections. Key types are arbitrary and the selection semantics
 * is the target value responsibility.
 */
export class KeyedSelector implements Selector {
  /** Keys to select in order */
  readonly keys: Value[];

  /**
   * @param keys - Keys to select
   */
  constructor(keys: Value[]) {
    if (keys.length == 0) throw new EmptySelectorError("empty selector");
    this.keys = keys;
  }

  /**
   * Factory function, returns a result instead of throwing.
   *
   * @param keys - Keys to select
   *
   * @returns      New selector or error
   */
  static create(keys: Value[]): [Result, Selector?] {
    if (keys.length == 0) return [ERROR("empty selector")];
    return [OK(NIL), new KeyedSelector(keys)];
  }

  /** @override */
  apply(value: Value): Result {
    for (const key of this.keys) {
      if (!value.selectKey) return ERROR("value is not key-selectable");
      const result = value.selectKey(key);
      if (result.code != ResultCode.OK) return result;
      value = result.value;
    }
    return OK(value);
  }

  /** @override */
  display(fn = defaultDisplayFunction): string {
    return `(${displayList(this.keys, fn)})`;
  }
}

/**
 * Generic selector
 *
 * Generic selectors delegate to {@link Value.selectRules}. They apply a set of
 * rules to any kind of value. Each rule is a tuple of values.
 */
export class GenericSelector implements Selector {
  /** Rules to apply */
  readonly rules: Value[];

  /**
   * @param rules - Rules to apply
   */
  constructor(rules: Value[]) {
    if (rules.length == 0) throw new EmptySelectorError("empty selector");
    this.rules = rules;
  }

  /**
   * Factory function, returns a result instead of throwing.
   *
   * @param rules - Rules to apply
   *
   * @returns       New selector or error
   */
  static create(rules: Value[]): [Result, Selector?] {
    if (rules.length == 0) return [ERROR("empty selector")];
    return [OK(NIL), new GenericSelector(rules)];
  }

  /** @override */
  apply(value: Value): Result {
    return selectGeneric(value, this);
  }

  /** @override */
  display(fn = defaultDisplayFunction): string {
    return `{${this.rules
      .map((rule) =>
        rule.type == ValueType.TUPLE
          ? displayList((rule as TupleValue).values, fn)
          : rule.display(fn)
      )
      .join("; ")}}`;
  }
}
