/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, ResultCode } from "../core/command";
import {
  ListValue,
  ScriptValue,
  StringValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { Scope } from "./core";

export const ARITY_ERROR = (signature: string) =>
  ERROR(new StringValue(`wrong # args: should be "${signature}"`));

export type Argument = {
  name: string;
  type: "required" | "optional" | "remainder";
  default?: Value;
};

export function buildArguments(scope: Scope, specs: Value): Argument[] {
  const args: Argument[] = [];
  const argnames = new Set<string>();
  let hasRemainder = false;
  for (const value of valueToArray(scope, specs)) {
    const arg = buildArgument(scope, value);
    if (arg.type == "remainder" && hasRemainder)
      throw new Error("only one remainder argument is allowed");
    if (argnames.has(arg.name))
      throw new Error(`duplicate argument "${arg.name}"`);
    hasRemainder = arg.type == "remainder";
    argnames.add(arg.name);
    args.push(arg);
  }
  return args;
}
function buildArgument(scope: Scope, value: Value): Argument {
  switch (value.type) {
    case ValueType.LIST:
    case ValueType.TUPLE:
    case ValueType.SCRIPT: {
      const specs = valueToArray(scope, value);
      if (specs.length == 0) throw new Error("empty argument specifier");
      const name = specs[0].asString();
      if (name == "" || name == "?") throw new Error("empty argument name");
      if (specs.length > 2)
        throw new Error(`too many specifiers for argument "${name}"`);
      if (specs.length == 2) {
        const def = specs[1];
        if (name[0] == "?") {
          return {
            name: name.substring(1),
            type: "optional",
            default: def,
          };
        } else {
          return { name, type: "optional", default: def };
        }
      } else {
        if (name[0] == "?") {
          return {
            name: name.substring(1),
            type: "optional",
          };
        } else {
          return { name, type: "required" };
        }
      }
    }
    default: {
      const name = value.asString();
      if (name == "" || name == "?") throw new Error("empty argument name");
      if (name[0] == "*") {
        if (name.length == 1) {
          return { name, type: "remainder" };
        } else {
          return { name: name.substring(1), type: "remainder" };
        }
      } else if (name[0] == "?") {
        return { name: name.substring(1), type: "optional" };
      } else {
        return { name, type: "required" };
      }
    }
  }
}

export function valueToArray(scope: Scope, value: Value): Value[] {
  switch (value.type) {
    case ValueType.LIST:
      return (value as ListValue).values;
    case ValueType.TUPLE:
      return (value as TupleValue).values;
    case ValueType.SCRIPT: {
      return scriptToValues(scope, value as ScriptValue);
    }
    default:
      return [value];
  }
}
function scriptToValues(scope: Scope, script: ScriptValue) {
  const values = [];
  for (const sentence of script.script.sentences) {
    for (const word of sentence.words) {
      const result = scope.executeWord(word);
      if (result.code != ResultCode.OK)
        throw new Error(result.value.asString());
      values.push(result.value);
    }
  }
  return values;
}
