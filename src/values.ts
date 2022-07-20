import { Script } from "./syntax";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";

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

export interface Value {
  type: ValueType;
  asString(): string;
  selectIndex(index: Value): Value;
  selectKey(key: Value): Value;
  selectRules(rules: Value[]): Value;
}

class NilValue implements Value {
  type = ValueType.NIL;
  asString(): string {
    throw new Error("nil has no string representation");
  }
  selectIndex(index: Value): Value {
    throw new Error("nil is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("nil is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("nil is not selectable");
  }
}
export const NIL = new NilValue();

export class BooleanValue implements Value {
  type = ValueType.BOOLEAN;
  value: boolean;
  constructor(value: boolean) {
    this.value = value;
  }
  static fromValue(value: Value): BooleanValue {
    switch (value.type) {
      case ValueType.BOOLEAN:
        return value as BooleanValue;
      case ValueType.INTEGER:
        return !!(value as IntegerValue).value ? TRUE : FALSE;
    }
    const s = value.asString();
    if (s == "true" || s == "yes" || s == "1") return TRUE;
    if (s == "false" || s == "no" || s == "0") return FALSE;
    const i = parseInt(s);
    if (isNaN(i)) throw new Error(`invalid boolean "${s}"`);
    return !!i ? TRUE : FALSE;
  }
  asString(): string {
    return this.value.toString();
  }
  selectIndex(index: Value): Value {
    throw new Error("value is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}
export const TRUE = new BooleanValue(true);
export const FALSE = new BooleanValue(false);

export class IntegerValue implements Value {
  type = ValueType.INTEGER;
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  static fromValue(value: Value): IntegerValue {
    if (value.type == ValueType.INTEGER) return value as IntegerValue;
    const s = value.asString();
    const i = parseInt(s);
    if (isNaN(i)) throw new Error(`invalid integer "${s}"`);
    return new IntegerValue(i);
  }
  asString(): string {
    return this.value.toString();
  }
  selectIndex(index: Value): Value {
    throw new Error("value is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class NumberValue implements Value {
  type = ValueType.NUMBER;
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  static fromValue(value: Value): NumberValue {
    if (value.type == ValueType.NUMBER) return value as NumberValue;
    const s = value.asString();
    const n = parseFloat(s);
    if (isNaN(n)) throw new Error(`invalid number "${s}"`);
    return new NumberValue(n);
  }
  asString(): string {
    return this.value.toString();
  }
  selectIndex(index: Value): Value {
    throw new Error("value is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class StringValue implements Value {
  type = ValueType.STRING;
  value: string;
  constructor(value: string) {
    this.value = value;
  }
  asString(): string {
    return this.value;
  }
  selectIndex(index: Value): Value {
    const i = IntegerValue.fromValue(index).value;
    if (i < 0 || i >= this.value.length) throw new Error("index out of range");
    return new StringValue(this.value[i]);
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class ListValue implements Value {
  type = ValueType.LIST;
  values: Value[];
  constructor(value: Value[]) {
    this.values = [...value];
  }
  asString(): string {
    throw new Error("value has no string representation");
  }
  selectIndex(index: Value): Value {
    const i = IntegerValue.fromValue(index).value;
    if (i < 0 || i >= this.values.length) throw new Error("index out of range");
    return this.values[i];
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class MapValue implements Value {
  type = ValueType.MAP;
  map: Map<string, Value>;
  constructor(value: { [key: string]: Value }) {
    this.map = new Map(Object.entries(value));
  }
  asString(): string {
    throw new Error("value has no string representation");
  }
  selectIndex(index: Value): Value {
    throw new Error("value is not index-selectable");
  }
  selectKey(key: Value): Value {
    const k = key.asString();
    if (!this.map.has(k)) throw new Error("unknown key");
    return this.map.get(k);
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class TupleValue implements Value {
  type = ValueType.TUPLE;
  values: Value[];
  constructor(values: Value[]) {
    this.values = [...values];
  }
  asString(): string {
    throw new Error("value has no string representation");
  }
  selectIndex(index: Value): Value {
    return new TupleValue(this.values.map((value) => value.selectIndex(index)));
  }
  selectKey(key: Value): Value {
    return new TupleValue(this.values.map((value) => value.selectKey(key)));
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class ScriptValue implements Value {
  type = ValueType.SCRIPT;
  script: Script;
  value: string;
  constructor(script: Script, value: string) {
    this.script = script;
    this.value = value;
  }
  asString(): string {
    return this.value;
  }
  selectIndex(index: Value): Value {
    throw new Error("value is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  selectRules(rules: Value[]): Value {
    throw new Error("value is not selectable");
  }
}

export class QualifiedValue implements Value {
  type = ValueType.QUALIFIED;
  source: Value;
  selectors: Selector[];
  constructor(name: Value, selectors: Selector[]) {
    this.source = name;
    this.selectors = selectors;
  }
  asString(): string {
    throw new Error("value has no string representation");
  }
  selectIndex(index: Value): Value {
    return new QualifiedValue(this.source, [
      ...this.selectors,
      new IndexedSelector(index),
    ]);
  }
  selectKey(key: Value): Value {
    if (
      this.selectors.length > 0 &&
      this.selectors[this.selectors.length - 1] instanceof KeyedSelector
    ) {
      const last = this.selectors[this.selectors.length - 1] as KeyedSelector;
      return new QualifiedValue(this.source, [
        ...this.selectors.slice(0, -1),
        new KeyedSelector([...last.keys, key]),
      ]);
    }
    return new QualifiedValue(this.source, [
      ...this.selectors,
      new KeyedSelector([key]),
    ]);
  }
  selectRules(rules: Value[]): Value {
    return new QualifiedValue(this.source, [
      ...this.selectors,
      new GenericSelector(rules),
    ]);
  }
}
