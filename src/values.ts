import { Script } from "./parser";

export enum ValueType {
  NIL,
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
    throw new Error("Method not implemented.");
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
    throw new Error("Method not implemented.");
  }
  selectIndex(index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
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
