/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ERROR, ResultCode } from "../core/results";
import { Command } from "../core/command";
import {
  Value,
  StringValue,
  ValueType,
  ScriptValue,
  NIL,
  STR,
  TUPLE,
} from "../core/values";
import { Argument, ARITY_ERROR, buildArguments, buildUsage } from "./arguments";
import { CommandValue, commandValueType, Scope } from "./core";
import { valueToArray } from "./lists";
import { Subcommands } from "./subcommands";

export class Argspec {
  readonly args: Argument[];
  readonly usage: StringValue;
  readonly nbRequired: number = 0;
  readonly nbOptional: number = 0;
  readonly hasRemainder: boolean = false;
  constructor(args: Argument[]) {
    this.args = args;
    this.usage = STR(buildUsage(args));
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
  isVariadic(): boolean {
    return this.nbOptional > 0 || this.hasRemainder;
  }
}

export class ArgspecValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly argspec: Argspec;
  constructor(argspec: Argspec) {
    this.command = this;
    this.argspec = argspec;
  }

  static fromValue(value: Value): Result<ArgspecValue> {
    if (value instanceof ArgspecValue) return OK(value, value);
    const { data: args, ...result } = buildArguments(value);
    if (result.code != ResultCode.OK) return result;
    const argspec = new Argspec(args);
    const command = new ArgspecValue(argspec);
    return OK(command, command);
  }

  usage(): string {
    return this.argspec.usage.asString();
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
    const nonRequired = values.length - skip - this.argspec.nbRequired;
    let optionals = Math.min(this.argspec.nbOptional, nonRequired);
    const remainders = nonRequired - optionals;
    let i = skip;
    for (const arg of this.argspec.args) {
      let value: Value;
      switch (arg.type) {
        case "required":
          value = values[i++];
          break;
        case "optional":
          if (optionals > 0) {
            optionals--;
            value = values[i++];
          } else if (arg.default) {
            if (arg.default.type == ValueType.SCRIPT) {
              const body = arg.default as ScriptValue;
              const result = scope.executeScriptValue(body);
              // TODO handle YIELD?
              if (result.code != ResultCode.OK) return result;
              value = result.value;
            } else {
              value = arg.default;
            }
          } else continue; // Skip missing optional
          break;
        case "remainder":
          value = TUPLE(values.slice(i, i + remainders));
          i += remainders;
          break;
      }
      if (arg.guard) {
        const process = scope.prepareTupleValue(TUPLE([arg.guard, value]));
        const result = process.run();
        // TODO handle YIELD?
        if (result.code != ResultCode.OK) return result;
        value = result.value;
      }
      const result = setArgument(arg.name, value);
      // TODO handle YIELD?
      if (result.code != ResultCode.OK) return result;
    }
    return OK(NIL);
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "usage",
    "set",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this);
    return ArgspecValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<argspec> subcommands");
        return OK(ArgspecValue.subcommands.list);
      },
      usage: () => {
        if (args.length != 2) return ARITY_ERROR("<argspec> usage");
        return OK(this.argspec.usage);
      },
      set: () => {
        if (args.length != 3) return ARITY_ERROR("<argspec> set values");
        const { data: values, ...result } = valueToArray(args[2]);
        if (result.code != ResultCode.OK) return result;
        // TODO handle YIELD?
        return this.setArguments(values, scope);
      },
    });
  }

  private setArguments(values: Value[], scope: Scope): Result {
    if (!this.checkArity(values, 0))
      return ERROR(`wrong # values: should be "${this.usage()}"`);
    return this.applyArguments(scope, values, 0, (name, value) =>
      scope.setNamedVariable(name, value)
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

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    if (name) {
      const result = scope.registerCommand(name, argspec);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(argspec);
  },
};
