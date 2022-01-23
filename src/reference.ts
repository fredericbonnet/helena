import { Value } from "./values";

export interface Reference {
  getValue(): Value;
  selectKey(key: Value): Reference;
}
