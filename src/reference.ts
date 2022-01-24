import { Value } from "./values";

export interface Reference {
  getValue(): Value;
  selectIndex(index: Value): Reference;
  selectKey(key: Value): Reference;
}
