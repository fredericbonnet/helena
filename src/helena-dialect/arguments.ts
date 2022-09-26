/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR } from "../core/command";
import { StringValue, Value } from "../core/values";

export type ArgSpec = {
  name: string;
  default?: Value;
};

export const ARITY_ERROR = (signature: string) =>
  ERROR(new StringValue(`wrong # args: should be "${signature}"`));

export function valueToArgspecs(_value: Value): ArgSpec[] {
  // TODO
  return [];
}
