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
  selectIndex(index: Value): Value;
  selectKey(key: Value): Value;
}

export class NilValue implements Value {
  selectIndex(index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
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
  selectIndex(index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
  }
}
export class TupleValue implements Value {
  type = ValueType.TUPLE;
  values: Value[];
  constructor(values: Value[]) {
    this.values = [...values];
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
  selectIndex(index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Value {
    throw new Error("Method not implemented.");
  }
}
