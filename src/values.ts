import { Script } from "./syntax";
import { Selector } from "./selectors";

export enum ValueType {
  NIL,
  INTEGER,
  STRING,
  LIST,
  MAP,
  TUPLE,
  SCRIPT,
  REFERENCE,
  CUSTOM,
}

export interface Value {
  type: ValueType;
  asString(): string;
  selectIndex(index: Value): Value;
  selectKey(key: Value): Value;
}

class NilValue implements Value {
  asString(): string {
    throw new Error("nil has no string representation");
  }
  selectIndex(index: Value): Value {
    throw new Error("nil is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("nil is not key-selectable");
  }
  type = ValueType.NIL;
}
export const NIL = new NilValue();

export class IntegerValue implements Value {
  value: number;
  constructor(value: number) {
    this.value = value;
  }
  static fromValue(value: Value): IntegerValue {
    if (value.type == ValueType.INTEGER) return value as IntegerValue;
    const integer = parseInt(value.asString());
    if (isNaN(integer)) throw new Error(`invalid integer ${value}`);
    return new IntegerValue(integer);
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
  type = ValueType.INTEGER;
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
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
  }
}

export class ReferenceValue implements Value {
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
    throw new Error("value is not index-selectable");
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
  type = ValueType.REFERENCE;
}
