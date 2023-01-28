/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  YIELD,
  CustomResultCode,
} from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, ValueType, TupleValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import {
  CommandValue,
  commandValueType,
  DeferredValue,
  Process,
  Scope,
} from "./core";
import { ArgspecValue } from "./argspecs";

export class EnsembleCommandValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;

  constructor(command: Command) {
    this.command = command;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
}

class EnsembleValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly ensemble: Command;
  constructor(command: Command, scope: Scope, argspec: ArgspecValue) {
    this.command = command;
    this.scope = scope;
    this.argspec = argspec;
    this.ensemble = new EnsembleCommand(this);
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
}
export class EnsembleValueCommand implements Command {
  readonly value: EnsembleValue;
  constructor(scope: Scope, argspec: ArgspecValue) {
    this.value = new EnsembleValue(this, scope, argspec);
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("ensemble eval body");
        return YIELD(new DeferredValue(args[2], this.value.scope));
      }
      case "call": {
        if (args.length < 3)
          return ARITY_ERROR("ensemble call cmdname ?arg ...?");
        const subcommand = args[2];
        if (!this.value.scope.hasLocalCommand(subcommand.asString()))
          return ERROR(`invalid command name "${subcommand.asString()}"`);
        const command = this.value.scope.resolveCommand(subcommand);
        const cmdline = [new EnsembleCommandValue(command), ...args.slice(3)];
        return YIELD(new DeferredValue(new TupleValue(cmdline), scope));
      }
      case "argspec":
        if (args.length != 2) return ARITY_ERROR("ensemble argspec");
        return OK(this.value.argspec);
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}

class EnsembleCommand implements Command {
  readonly value: EnsembleValue;
  constructor(value: EnsembleValue) {
    this.value = value;
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    const minArgs = this.value.argspec.argspec.nbRequired + 1;
    if (args.length < minArgs)
      return ARITY_ERROR(
        `ensemble ${this.value.argspec.help()} ?cmdname? ?arg ...?`
      );
    if (args.length == minArgs) {
      return OK(new TupleValue(args.slice(1)));
    }
    const subcommand = args[minArgs];
    if (!this.value.scope.hasLocalCommand(subcommand.asString()))
      return ERROR(`invalid subcommand name "${subcommand.asString()}"`);
    const command = this.value.scope.resolveCommand(subcommand);
    const cmdline = [
      new EnsembleCommandValue(command),
      ...args.slice(1, minArgs),
      ...args.slice(minArgs + 1),
    ];
    return YIELD(new DeferredValue(new TupleValue(cmdline), scope));
  }
}

type EnsembleBodyState = {
  scope: Scope;
  subscope: Scope;
  process: Process;
  argspec: ArgspecValue;
  name?: Value;
};
export const ensembleCmd: Command = {
  execute: (args, scope: Scope) => {
    let name, spec, body;
    switch (args.length) {
      case 3:
        [, spec, body] = args;
        break;
      case 4:
        [, name, spec, body] = args;
        break;
      default:
        return ARITY_ERROR("ensemble ?name? argspec body");
    }

    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const { data: argspec, ...result } = ArgspecValue.fromValue(spec);
    if (result.code != ResultCode.OK) return result;
    if (argspec.argspec.isVariadic())
      return ERROR("ensemble arguments cannot be variadic");

    const subscope = new Scope(scope);
    const process = subscope.prepareScriptValue(body as ScriptValue);
    return executeEnsembleBody({ scope, subscope, process, argspec, name });
  },
  resume(result: Result): Result {
    const state = result.data as EnsembleBodyState;
    state.process.yieldBack(result.value);
    return executeEnsembleBody(state);
  },
};
const executeEnsembleBody = (state: EnsembleBodyState): Result => {
  const result = state.process.run();
  switch (result.code) {
    case ResultCode.OK:
    case ResultCode.RETURN: {
      const command = new EnsembleValueCommand(state.subscope, state.argspec);
      if (state.name) {
        state.scope.registerCommand(
          state.name.asString(),
          command.value.ensemble
        );
      }
      return OK(
        result.code == ResultCode.RETURN ? result.value : command.value
      );
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    case ResultCode.BREAK:
      return ERROR("unexpected break");
    case ResultCode.CONTINUE:
      return ERROR("unexpected continue");
    default:
      return ERROR("unexpected " + (result.code as CustomResultCode).name);
  }
};
