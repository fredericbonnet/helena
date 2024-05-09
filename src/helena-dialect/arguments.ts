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
  readonly option?: Option;
};
export type Option = {
  readonly names: string[];
  readonly type: "flag" | "option";
};

export function buildArguments(specs: Value): Result<Argument[]> {
  const args: Argument[] = [];
  const argnames = new Set<string>();
  const optnames = new Set<string>();
  let hasRemainder = false;
  const { data: values, ...result } = valueToArray(specs);
  if (result.code != ResultCode.OK) return ERROR("invalid argument list");
  let lastOption: Option = null;
  for (const value of values) {
    const { data: option, ...result } = isOption(value);
    if (result.code != ResultCode.OK) return result;
    if (option) {
      for (const optname of option.names) {
        if (optnames.has(optname))
          return ERROR(`duplicate option "${optname}"`);
        optnames.add(optname);
      }
      lastOption = option;
      continue;
    }
    const { data: arg, ...result2 } = buildArgument(value);
    if (result2.code != ResultCode.OK) return result2;
    if (lastOption) {
      if (lastOption.type == "flag" && arg.type != "optional") {
        return ERROR(
          `argument for flag "${lastOption.names.join("|")}" must be optional`
        );
      }
      if (arg.type != "required" && hasRemainder) {
        return ERROR(
          "cannot use remainder argument before a non-required option"
        );
      }
      args.push({ ...arg, option: lastOption });
      lastOption = null;
      continue;
    }

    if (arg.type == "remainder" && hasRemainder)
      return ERROR("only one remainder argument is allowed");
    if (argnames.has(arg.name))
      return ERROR(`duplicate argument "${arg.name}"`);
    hasRemainder = arg.type == "remainder";
    argnames.add(arg.name);
    args.push(arg);
  }
  if (lastOption) {
    return ERROR(`missing argument for option "${lastOption.names.join("|")}"`);
  }
  return OK(NIL, args);
}
function isOption(value: Value): Result<Option> {
  let options: Value[];
  switch (value.type) {
    case ValueType.LIST:
    case ValueType.TUPLE:
    case ValueType.SCRIPT: {
      const { data, ...result } = valueToArray(value);
      if (result.code != ResultCode.OK) return result;
      options = data;
      break;
    }
    default:
      options = [value];
  }
  if (options.length == 0) return OK(NIL);

  let type: "option" | "flag";
  const names: string[] = [];
  for (const option of options) {
    const { data: name, code } = StringValue.toString(option);
    if (code != ResultCode.OK) break;
    if (name.length < 1) break;
    if (name[0] == "-") {
      // Option
      if (name.length < 2) break;
      if (type && type != "option") break;
      type = "option";
      names.push(name);
    } else if (name[0] == "?") {
      // Flag
      if (name.length < 3) break;
      if (name[1] != "-") break;
      if (type && type != "flag") break;
      type = "flag";
      names.push(name.substring(1));
    } else break;
  }
  if (!type) return OK(NIL);
  if (names.length != options.length) {
    return ERROR(`incompatible aliases for option "${names.join("|")}"`);
  }
  return OK(NIL, { names, type });
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
          if (code1 == ResultCode.OK && nameOrGuard[0] == "?") {
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
    if (arg.option) {
      const name = arg.option.names.join("|");
      switch (arg.option.type) {
        case "flag":
          parts.push(`?${name}?`);
          break;
        case "option":
          switch (arg.type) {
            case "required":
              parts.push(`${name} ${arg.name}`);
              break;
            case "optional":
              parts.push(`?${name} ${arg.name}?`);
              break;
            default:
              throw new Error("CANTHAPPEN");
          }
          break;
      }
    } else {
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
  }
  return parts.join(" ");
}
