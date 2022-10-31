/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, OK, ERROR, ResultCode } from "../core/command";
import {
  Value,
  StringValue,
  ValueType,
  ScriptValue,
  NIL,
  TupleValue,
} from "../core/values";
import {
  Argument,
  ARITY_ERROR,
  buildArguments,
  buildHelp,
  valueToArray,
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

  static fromValue(scope: Scope, value: Value): ArgspecValue {
    if (value instanceof ArgspecValue) return value;
    const args = buildArguments(scope, value);
    const argspec = new Argspec(args);
    const command = new ArgspecCommand(argspec);
    return command.value;
  }

  help(): string {
    return this.argspec.help.asString();
  }
  checkArity(values: Value[], skip: number) {
    return (
      values.length - skip >= this.argspec.nbRequired &&
      (this.argspec.hasRemainder ||
        values.length - skip <=
          this.argspec.nbRequired + this.argspec.nbOptional)
    );
  }
  applyArguments(
    scope: Scope,
    values: Value[],
    skip: number,
    setArgument: (name: string, value: Value) => Result
  ): Result {
    let setOptionals = Math.min(
      this.argspec.nbOptional,
      values.length - this.argspec.nbRequired
    );
    const setRemainder = values.length - this.argspec.nbRequired - setOptionals;
    let i = skip;
    for (const arg of this.argspec.args) {
      let value: Value;
      switch (arg.type) {
        case "required":
          value = values[i++];
          break;
        case "optional":
          if (setOptionals > 0) {
            setOptionals--;
            value = values[i++];
          } else if (arg.default) {
            if (arg.default.type == ValueType.SCRIPT) {
              const body = arg.default as ScriptValue;
              const result = scope.executeScript(body);
              // TODO handle YIELD?
              if (result.code != ResultCode.OK) return result;
              value = result.value;
            } else {
              value = arg.default;
            }
          } else continue; // Skip missing optional
          break;
        case "remainder":
          value = new TupleValue(values.slice(i, i + setRemainder));
          i += setRemainder;
          break;
      }
      const result = setArgument(arg.name, value);
      // TODO handle YIELD?
      if (result.code != ResultCode.OK) return result;
    }
    return OK(NIL);
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
        // TODO handle YIELD?
        return this.setArguments(valueToArray(scope, args[2]), scope);
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }

  setArguments(values: Value[], scope: Scope): Result {
    if (!this.value.checkArity(values, 0))
      return ERROR(`wrong # values: should be "${this.value.help()}"`);
    return this.value.applyArguments(scope, values, 0, (name, value) =>
      scope.setVariable(name, value)
    );
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

    try {
      const argspec = ArgspecValue.fromValue(scope, specs);
      if (name) {
        scope.registerCommand(name.asString(), argspec.command);
      }
      return OK(argspec);
    } catch (e) {
      return ERROR(e.message);
    }
  },
};
