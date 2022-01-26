import { Script } from "./parser";

export enum ValueType {
  NIL,
  INTEGER,
  STRING,
  TUPLE,
  SCRIPT,
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
    const i = IntegerValue.fromValue(index).value;
    if (i < 0 || i >= this.values.length) throw new Error("index out of range");
    return this.values[i];
  }
  selectKey(key: Value): Value {
    throw new Error("value is not key-selectable");
  }
}

export class ScriptValue implements Value {
  type = ValueType.SCRIPT;
  script: Script;
  constructor(script: Script) {
    this.script = script;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
  }
}
