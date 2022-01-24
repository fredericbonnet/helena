import { Reference } from "./reference";
import { Value, ValueType } from "./values";

export interface Selector {
  apply(reference: Reference): Reference;
}

export class IndexedSelector implements Selector {
  index: Value;
  constructor(index: Value) {
    if (index.type != ValueType.LITERAL) throw new Error("invalid index");
    this.index = index;
  }
  apply(reference: Reference): Reference {
    return reference.selectIndex(this.index);
  }
}

export class KeyedSelector implements Selector {
  keys: Value[];
  constructor(keys: Value[]) {
    if (keys.length == 0) throw new Error("empty selector");
    this.keys = keys;
  }
  apply(reference: Reference): Reference {
    for (let key of this.keys) {
      reference = reference.selectKey(key);
    }
    return reference;
  }
}
