import { Script } from "./parser";

export enum ValueType {
  NIL,
  LITERAL,
  TUPLE,
  SCRIPT,
}

export class NilValue {
  type: ValueType.NIL;
}
export const NIL = new NilValue();
export class LiteralValue {
  type: ValueType = ValueType.LITERAL;
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}
export class TupleValue {
  type: ValueType = ValueType.TUPLE;
  values: Value[];
  constructor(values: Value[]) {
    this.values = [...values];
  }
}
export class ScriptValue {
  type: ValueType = ValueType.SCRIPT;
  script: Script;
  constructor(script: Script) {
    this.script = script;
  }
}
export type Value = NilValue | LiteralValue | TupleValue | ScriptValue;
