/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, OK, Result, ResultCode } from "../core/results";
import { NIL, Value, ValueType } from "../core/values";
import { valueToArray } from "./lists";

export const ARITY_ERROR = (signature: string) =>
  ERROR(`wrong # args: should be "${signature}"`);

export type Argument = {
  name: string;
  type: "required" | "optional" | "remainder";
  default?: Value;
};

export function buildArguments(specs: Value): Result<Argument[]> {
  const args: Argument[] = [];
  const argnames = new Set<string>();
  let hasRemainder = false;
  const { data: values, ...result } = valueToArray(specs);
  if (result.code != ResultCode.OK) return ERROR("invalid argument list");
  for (const value of values) {
    const { data: arg, ...result } = buildArgument(value);
    if (result.code != ResultCode.OK) return result;
    if (arg.type == "remainder" && hasRemainder)
      return ERROR("only one remainder argument is allowed");
    if (argnames.has(arg.name))
      return ERROR(`duplicate argument "${arg.name}"`);
    hasRemainder = arg.type == "remainder";
    argnames.add(arg.name);
    args.push(arg);
  }
  return OK(NIL, args);
}
function buildArgument(value: Value): Result<Argument> {
  switch (value.type) {
    case ValueType.LIST:
    case ValueType.TUPLE:
    case ValueType.SCRIPT: {
      const { data: specs, ...result } = valueToArray(value);
      if (result.code != ResultCode.OK) return result;
      if (specs.length == 0) return ERROR("empty argument specifier");
      const name = specs[0].asString?.();
      if (name == null) return ERROR("invalid argument name");
      if (name == "" || name == "?") return ERROR("empty argument name");
      if (specs.length > 2)
        return ERROR(`too many specifiers for argument "${name}"`);
      if (specs.length == 2) {
        const def = specs[1];
        if (name[0] == "?") {
          return OK(NIL, {
            name: name.substring(1),
            type: "optional",
            default: def,
          });
        } else {
          return OK(NIL, { name, type: "optional", default: def });
        }
      } else if (name[0] == "?") {
        return OK(NIL, { name: name.substring(1), type: "optional" });
      } else {
        return OK(NIL, { name, type: "required" });
      }
    }
    default: {
      const name = value.asString?.();
      if (name == null) return ERROR("invalid argument name");
      if (name == "" || name == "?") return ERROR("empty argument name");
      if (name[0] == "*") {
        if (name.length == 1) {
          return OK(NIL, { name, type: "remainder" });
        } else {
          return OK(NIL, { name: name.substring(1), type: "remainder" });
        }
      } else if (name[0] == "?") {
        return OK(NIL, { name: name.substring(1), type: "optional" });
      } else {
        return OK(NIL, { name, type: "required" });
      }
    }
  }
}
export function buildHelp(args: Argument[]) {
  const parts = [];
  for (const arg of args) {
    switch (arg.type) {
      case "required":
        parts.push(arg.name);
        break;
      case "optional":
        parts.push(`?${arg.name}?`);
        break;
      case "remainder":
        parts.push(`?${arg.name == "*" ? "arg" : arg.name} ...?`);
        break;
    }
  }
  return parts.join(" ");
}
