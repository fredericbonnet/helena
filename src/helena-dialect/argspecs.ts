/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, OK, ERROR, ResultCode } from "../core/command";
import {
  Value,
  StringValue,
  ValueType,
  ListValue,
  TupleValue,
  ScriptValue,
  NIL,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, Scope } from "./core";

type Argument = {
  name: string;
  type: "required" | "optional" | "remainder";
  default?: Value;
};

export class ArgspecValue extends CommandValue {
  readonly args: Argument[];
  readonly help: StringValue;
  readonly nbRequired: number = 0;
  readonly nbOptional: number = 0;
  readonly hasRemainder: boolean = false;
  constructor(args: Argument[]) {
    super((scope) => new ArgspecCommand(scope, this));
    this.args = args;
    this.help = new StringValue(buildHelp(args));
    for (const arg of args) {
      switch (arg.type) {
        case "required":
          this.nbRequired++;
          break;
        case "optional":
          this.nbOptional++;
          break;
        case "remainder":
          this.hasRemainder = true;
          break;
      }
    }
  }
}
class ArgspecCommand implements Command {
  readonly scope: Scope;
  readonly value: ArgspecValue;
  constructor(scope: Scope, value: ArgspecValue) {
    this.scope = scope;
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("argspec method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "help": {
        if (args.length != 2) return ARITY_ERROR("argspec help");
        return OK(this.value.help);
      }
      case "set": {
        if (args.length != 3) return ARITY_ERROR("argspec set values");
        setArguments(
          this.scope,
          this.value,
          valueToList(this.scope, args[2]).values
        );
        return OK(NIL);
      }
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
    }
  }
}
export const argspecCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let name, specs;
    switch (args.length) {
      case 2:
        [, specs] = args;
        break;
      case 3:
        [, name, specs] = args;
        break;
      default:
        return ARITY_ERROR("argspec ?name? specs");
    }

    const value = new ArgspecValue(buildArgspec(scope, specs));
    if (name) {
      scope.registerCommand(name.asString(), value.command);
    }
    return OK(value);
  },
});

function buildArgspec(scope, specs: ListValue): Argument[] {
  const args: Argument[] = [];
  const argnames = new Set<string>();
  let hasRemainder = false;
  for (const value of valueToList(scope, specs).values) {
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
      const specs = valueToList(scope, value).values;
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

function buildHelp(args: Argument[]) {
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

function valueToList(scope: Scope, value: Value): ListValue {
  switch (value.type) {
    case ValueType.LIST:
      return value as ListValue;
    case ValueType.TUPLE:
      return new ListValue((value as TupleValue).values);
    case ValueType.SCRIPT: {
      return scriptToList(scope, value as ScriptValue);
    }
    default:
      return new ListValue([value]);
  }
}
function scriptToList(scope: Scope, script: ScriptValue) {
  const values = [];
  for (const sentence of script.script.sentences) {
    for (const word of sentence.words) {
      const result = scope.executeWord(word);
      if (result.code != ResultCode.OK)
        throw new Error(result.value.asString());
      values.push(result.value);
    }
  }
  return new ListValue(values);
}

function setArguments(scope: Scope, argspec: ArgspecValue, values: Value[]) {
  if (
    values.length < argspec.nbRequired ||
    (!argspec.hasRemainder &&
      values.length > argspec.nbRequired + argspec.nbOptional)
  )
    throw new Error(`wrong # values: should be "${argspec.help.asString()}"`);

  let setOptionals = Math.min(
    argspec.nbOptional,
    values.length - argspec.nbRequired
  );
  const setRemainder = values.length - argspec.nbRequired - setOptionals;
  let i = 0;
  for (const arg of argspec.args) {
    switch (arg.type) {
      case "required":
        scope.setVariable(arg.name, values[i++]);
        break;
      case "optional":
        if (setOptionals > 0) {
          setOptionals--;
          scope.setVariable(arg.name, values[i++]);
        } else if (arg.default) {
          if (arg.default.type == ValueType.SCRIPT) {
            const body = arg.default as ScriptValue;
            const result = scope.executeScript(body);
            // TODO propagate result codes
            scope.setVariable(arg.name, result.value);
          } else {
            scope.setVariable(arg.name, arg.default);
          }
        }
        break;
      case "remainder":
        scope.setVariable(
          arg.name,
          new ListValue(values.slice(i, i + setRemainder))
        );
        i += setRemainder;
    }
  }
}
