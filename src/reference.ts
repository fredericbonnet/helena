import { Value } from "./values";

export interface Reference {
  value(): Value;
  selectKey(key: Value): Reference;
}
