/**
 * @file Helena value selectors
 */

import { ERROR, OK, Result, ResultCode } from "./results";
import { NIL, TupleValue, Value, ValueType } from "./values";
import { defaultDisplayFunction, Displayable, displayList } from "./display";

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
  private constructor(index: Value) {
    if (index == NIL) throw new Error("invalid index");
    this.index = index;
  }

  /**
   * Factory function, returns a result instead of throwing like the
   * constructor.
   *
   * @param index - Index to select
   *
   * @returns       New selector or error
   */
  static create(index: Value): [Result, IndexedSelector?] {
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
  private constructor(keys: Value[]) {
    if (keys.length == 0) throw new Error("empty selector");
    this.keys = keys;
  }

  /**
   * Factory function, returns a result instead of throwing.
   *
   * @param keys - Keys to select
   *
   * @returns      New selector or error
   */
  static create(keys: Value[]): [Result, KeyedSelector?] {
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
  private constructor(rules: Value[]) {
    if (rules.length == 0) throw new Error("empty selector");
    this.rules = rules;
  }

  /**
   * Factory function, returns a result instead of throwing.
   *
   * @param rules - Rules to apply
   *
   * @returns       New selector or error
   */
  static create(rules: Value[]): [Result, GenericSelector?] {
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
