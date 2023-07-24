/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  YIELD,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import {
  Value,
  ScriptValue,
  ValueType,
  LIST,
  STR,
  TUPLE,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import {
  CommandValue,
  commandValueType,
  DeferredValue,
  Process,
  Scope,
} from "./core";
import { ArgspecValue } from "./argspecs";
import { Subcommands } from "./subcommands";

export class EnsembleCommandValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;

  constructor(command: Command) {
    this.command = command;
  }
}

export class EnsembleValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly ensemble: Command;
  constructor(scope: Scope, argspec: ArgspecValue) {
    this.command = this;
    this.scope = scope;
    this.argspec = argspec;
    this.ensemble = new EnsembleCommand(this);
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "eval",
    "call",
    "argspec",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this);
    return EnsembleValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<ensemble> subcommands");
        return OK(EnsembleValue.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<ensemble> eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<ensemble> call cmdname ?arg ...?");
        const subcommand = args[2].asString?.();
        if (subcommand == null) return ERROR("invalid command name");
        if (!this.scope.hasLocalCommand(subcommand))
          return ERROR(`unknown command "${subcommand}"`);
        const command = this.scope.resolveNamedCommand(subcommand);
        const cmdline = [new EnsembleCommandValue(command), ...args.slice(3)];
        return YIELD(new DeferredValue(TUPLE(cmdline), scope));
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<ensemble> argspec");
        return OK(this.argspec);
      },
    });
  }
}

const ENSEMBLE_COMMAND_SIGNATURE = (name, help, signature) =>
  `${name.asString?.() ?? "<ensemble>"} ${help ? help + " " : ""}${signature}`;

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
        ENSEMBLE_COMMAND_SIGNATURE(
          args[0],
          this.value.argspec.usage(),
          "?cmdname? ?arg ...?"
        )
      );
    const ensembleArgs = [];
    const getargs = (_name, value) => {
      ensembleArgs.push(value);
      return OK(value);
    };
    const result = this.value.argspec.applyArguments(
      scope,
      args.slice(1, minArgs),
      0,
      getargs
    );
    if (result.code != ResultCode.OK) return result;
    if (args.length == minArgs) {
      return OK(TUPLE(ensembleArgs));
    }
    const subcommand = args[minArgs].asString?.();
    if (subcommand == null) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length != minArgs + 1) {
        return ARITY_ERROR(
          ENSEMBLE_COMMAND_SIGNATURE(
            args[0],
            this.value.argspec.usage(),
            "subcommands"
          )
        );
      }
      return OK(
        LIST([
          args[minArgs],
          ...this.value.scope.getLocalCommands().map((name) => STR(name)),
        ])
      );
    }
    if (!this.value.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const command = this.value.scope.resolveNamedCommand(subcommand);
    const cmdline = [
      new EnsembleCommandValue(command),
      ...ensembleArgs,
      ...args.slice(minArgs + 1),
    ];
    return YIELD(new DeferredValue(TUPLE(cmdline), scope));
  }
}

const ENSEMBLE_SIGNATURE = "ensemble ?name? argspec body";
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
        return ARITY_ERROR(ENSEMBLE_SIGNATURE);
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
  help(args) {
    if (args.length > 4) return ARITY_ERROR(ENSEMBLE_SIGNATURE);
    return OK(STR(ENSEMBLE_SIGNATURE));
  },
};
const executeEnsembleBody = (state: EnsembleBodyState): Result => {
  const result = state.process.run();
  switch (result.code) {
    case ResultCode.OK:
    case ResultCode.RETURN: {
      const value = new EnsembleValue(state.subscope, state.argspec);
      if (state.name) {
        const result = state.scope.registerCommand(state.name, value.ensemble);
        if (result.code != ResultCode.OK) return result;
      }
      return OK(result.code == ResultCode.RETURN ? result.value : value);
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
