/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, OK, Result, ResultCode } from "../core/results";
import { NIL, StringValue, Value, ValueType } from "../core/values";
import { valueToArray } from "./lists";

export const ARITY_ERROR = (signature: string) =>
  ERROR(`wrong # args: should be "${signature}"`);

export type Argument = {
  readonly name: string;
  readonly type: "required" | "optional" | "remainder";
  readonly default?: Value;
  readonly guard?: Value;
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
      switch (specs.length) {
        case 0:
          return ERROR("empty argument specifier");
        case 1: {
          const { data: name, code } = StringValue.toString(specs[0]);
          if (code != ResultCode.OK) return ERROR("invalid argument name");
          if (name == "" || name == "?") return ERROR("empty argument name");
          if (name[0] == "?") {
            return OK(NIL, { name: name.substring(1), type: "optional" });
          } else {
            return OK(NIL, { name, type: "required" });
          }
        }
        case 2: {
          const { data: nameOrGuard, code: code1 } = StringValue.toString(
            specs[0]
          );
          const { data: nameOrDefault, code: code2 } = StringValue.toString(
            specs[1]
          );
          if (code1 != ResultCode.OK && code2 != ResultCode.OK)
            return ERROR("invalid argument name");
          if (
            (nameOrGuard == "" || nameOrGuard == "?") &&
            (nameOrDefault == "" || nameOrDefault == "?")
          )
            return ERROR("empty argument name");
          if (nameOrGuard && nameOrGuard[0] == "?") {
            return OK(NIL, {
              name: nameOrGuard.substring(1),
              type: "optional",
              default: specs[1],
            });
          } else if (nameOrDefault[0] == "?") {
            return OK(NIL, {
              name: nameOrDefault.substring(1),
              type: "optional",
              guard: specs[0],
            });
          } else {
            return OK(NIL, {
              name: nameOrDefault,
              type: "required",
              guard: specs[0],
            });
          }
        }
        case 3: {
          const { data: name, code } = StringValue.toString(specs[1]);
          if (code != ResultCode.OK) return ERROR("invalid argument name");
          if (name == "" || name == "?") return ERROR("empty argument name");
          if (name[0] != "?")
            return ERROR(`default argument "${name}" must be optional`);
          return OK(NIL, {
            name: name.substring(1),
            type: "optional",
            default: specs[2],
            guard: specs[0],
          });
        }
        default: {
          const { data: name, code } = StringValue.toString(specs[0]);
          if (code != ResultCode.OK) return ERROR("invalid argument name");
          return ERROR(`too many specifiers for argument "${name}"`);
        }
      }
    }
    default: {
      const { data: name, code } = StringValue.toString(value);
      if (code != ResultCode.OK) return ERROR("invalid argument name");
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
export function buildUsage(args: Argument[], skip = 0) {
  const parts = [];
  for (let i = skip; i < args.length; i++) {
    const arg = args[i];
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
