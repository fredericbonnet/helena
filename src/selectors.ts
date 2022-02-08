import { Value, ValueType } from "./values";

export interface Selector {
  apply(value: Value): Value;
}

export class IndexedSelector implements Selector {
  index: Value;
  constructor(index: Value) {
    if (index.type == ValueType.NIL) throw new Error("invalid index");
    this.index = index;
  }
  apply(value: Value): Value {
    return value.selectIndex(this.index);
  }
}

export class KeyedSelector implements Selector {
  keys: Value[];
  constructor(keys: Value[]) {
    if (keys.length == 0) throw new Error("empty selector");
    this.keys = keys;
  }
  apply(value: Value): Value {
    for (let key of this.keys) {
      value = value.selectKey(key);
    }
    return value;
  }
}
