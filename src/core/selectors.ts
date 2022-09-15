/**
 * @file Helena value selectors
 */

import { NIL, Value } from "./values";

/**
 * Helena selector
 *
 * Selectors apply to values to access their subvalues
 */
export interface Selector {
  /**
   * Apply selector to given value
   *
   * @param value - Target value
   *
   * @returns       Selected subvalue
   */
  apply(value: Value): Value;
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
  index: Value;

  /**
   * @param index - Index to select
   */
  constructor(index: Value) {
    if (index == NIL) throw new Error("invalid index");
    this.index = index;
  }

  /** @override */
  apply(value: Value): Value {
    return value.selectIndex(this.index);
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
  keys: Value[];

  /**
   * @param keys - Keys to select
   */
  constructor(keys: Value[]) {
    if (keys.length == 0) throw new Error("empty selector");
    this.keys = keys;
  }

  /** @override */
  apply(value: Value): Value {
    for (const key of this.keys) {
      value = value.selectKey(key);
    }
    return value;
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
  rules: Value[];

  /**
   * @param rules - Rules to apply
   */
  constructor(rules: Value[]) {
    if (rules.length == 0) throw new Error("empty selector");
    this.rules = rules;
  }

  /** @override */
  apply(value: Value): Value {
    return value.selectRules(this.rules);
  }
}
