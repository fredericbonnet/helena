/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, OK, ERROR } from "../core/command";
import {
  Value,
  StringValue,
  ValueType,
  ListValue,
  ScriptValue,
  NIL,
} from "../core/values";
import {
  Argument,
  ARITY_ERROR,
  buildArguments,
  valueToList,
} from "./arguments";
import { CommandValue, Scope } from "./core";

export class Argspec {
  readonly args: Argument[];
  readonly help: StringValue;
  readonly nbRequired: number = 0;
  readonly nbOptional: number = 0;
  readonly hasRemainder: boolean = false;
  constructor(args: Argument[]) {
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

export class ArgspecValue extends CommandValue {
  readonly argspec: Argspec;
  constructor(command: Command, argspec: Argspec) {
    super(command);
    this.argspec = argspec;
  }
}
class ArgspecCommand implements Command {
  readonly value: ArgspecValue;
  constructor(argspec: Argspec) {
    this.value = new ArgspecValue(this, argspec);
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("argspec method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "help": {
        if (args.length != 2) return ARITY_ERROR("argspec help");
        return OK(this.value.argspec.help);
      }
      case "set": {
        if (args.length != 3) return ARITY_ERROR("argspec set values");
        setArguments(
          scope,
          this.value.argspec,
          valueToList(scope, args[2]).values
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
export const argspecCmd: Command = {
  execute: (args, scope: Scope) => {
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

    const argspec = valueToArgspec(scope, specs);
    const command = new ArgspecCommand(argspec);
    if (name) {
      scope.registerCommand(name.asString(), command);
    }
    return OK(command.value);
  },
};

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

function setArguments(
  scope: Scope,
  argspec: Argspec,
  values: Value[],
  skip = 0
) {
  if (!checkArity(argspec, values, skip))
    throw new Error(`wrong # values: should be "${argspec.help.asString()}"`);
  applyArguments(scope, argspec, values, skip, (name, value) =>
    scope.setVariable(name, value)
  );
}
export function checkArity(argspec: Argspec, values: Value[], skip) {
  return (
    values.length - skip >= argspec.nbRequired &&
    (argspec.hasRemainder ||
      values.length - skip <= argspec.nbRequired + argspec.nbOptional)
  );
}
export function applyArguments(
  scope: Scope,
  argspec: Argspec,
  values: Value[],
  skip: number,
  setArgument: (name: string, value: Value) => Result
) {
  let setOptionals = Math.min(
    argspec.nbOptional,
    values.length - argspec.nbRequired
  );
  const setRemainder = values.length - argspec.nbRequired - setOptionals;
  let i = skip;
  for (const arg of argspec.args) {
    switch (arg.type) {
      case "required":
        setArgument(arg.name, values[i++]);
        break;
      case "optional":
        if (setOptionals > 0) {
          setOptionals--;
          setArgument(arg.name, values[i++]);
        } else if (arg.default) {
          if (arg.default.type == ValueType.SCRIPT) {
            const body = arg.default as ScriptValue;
            const result = scope.executeScript(body);
            // TODO propagate result codes
            setArgument(arg.name, result.value);
          } else {
            setArgument(arg.name, arg.default);
          }
        }
        break;
      case "remainder":
        setArgument(arg.name, new ListValue(values.slice(i, i + setRemainder)));
        i += setRemainder;
    }
  }
}

export function valueToArgspec(scope: Scope, value: Value): Argspec {
  if (value instanceof ArgspecValue) return value.argspec;
  return new Argspec(buildArguments(scope, value));
}
