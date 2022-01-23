import { Reference } from "./reference";
import { Value } from "./values";

export interface Selector {
  apply(reference: Reference): Reference;
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
