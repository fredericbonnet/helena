/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ERROR, ResultCode } from "../core/results";
import { Command } from "../core/command";
import {
  Value,
  ValueType,
  ScriptValue,
  NIL,
  STR,
  TUPLE,
  LIST,
  CustomValue,
} from "../core/values";
import { Argument, ARITY_ERROR, buildArguments, buildUsage } from "./arguments";
import { Scope } from "./core";
import { valueToArray } from "./lists";
import { EnsembleCommand } from "./ensembles";

export class Argspec {
  readonly args: Argument[];
  readonly nbRequired: number = 0;
  readonly nbOptional: number = 0;
  readonly hasRemainder: boolean = false;
  constructor(args: Argument[]) {
    this.args = args;
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

export class ArgspecValue implements CustomValue {
  readonly type = ValueType.CUSTOM;
  readonly customType = { name: "argspec" };

  readonly argspec: Argspec;
  constructor(argspec: Argspec) {
    this.argspec = argspec;
  }

  static fromValue(value: Value): Result<ArgspecValue> {
    if (value instanceof ArgspecValue) return OK(value, value);
    const { data: args, ...result } = buildArguments(value);
    if (result.code != ResultCode.OK) return result;
    const v = new ArgspecValue(new Argspec(args));
    return OK(v, v);
  }

  usage(skip = 0): string {
    return buildUsage(this.argspec.args, skip);
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

  setArguments(values: Value[], scope: Scope): Result {
    if (!this.checkArity(values, 0))
      return ERROR(`wrong # values: should be "${this.usage()}"`);
    return this.applyArguments(scope, values, 0, (name, value) =>
      scope.setNamedVariable(name, value)
    );
  }
}

class ArgspecCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return ArgspecValue.fromValue(args[1]);
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const ARGSPEC_USAGE_SIGNATURE = "argspec value usage";
const argspecUsageCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(ARGSPEC_USAGE_SIGNATURE);
    const { data: value, ...result } = ArgspecValue.fromValue(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(STR(value.usage()));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(ARGSPEC_USAGE_SIGNATURE);
    return OK(STR(ARGSPEC_USAGE_SIGNATURE));
  },
};

const ARGSPEC_SET_SIGNATURE = "argspec value set values";
const argspecSetCmd: Command = {
  execute(args, scope: Scope) {
    if (args.length != 3) return ARITY_ERROR(ARGSPEC_SET_SIGNATURE);
    const { data: value, ...result } = ArgspecValue.fromValue(args[1]);
    if (result.code != ResultCode.OK) return result;
    const { data: values, ...result2 } = valueToArray(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    return value.setArguments(values, scope);
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(ARGSPEC_SET_SIGNATURE);
    return OK(STR(ARGSPEC_SET_SIGNATURE));
  },
};

export function registerArgspecCommands(scope: Scope) {
  const command = new ArgspecCommand(scope);
  scope.registerNamedCommand("argspec", command);
  command.scope.registerNamedCommand("usage", argspecUsageCmd);
  command.scope.registerNamedCommand("set", argspecSetCmd);
}
