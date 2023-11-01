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
  StringValue,
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

export class EnsembleMetacommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly ensemble: Command;
  EnsembleCommandValue;
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
    return EnsembleMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<ensemble> subcommands");
        return OK(EnsembleMetacommand.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<ensemble> eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<ensemble> call cmdname ?arg ...?");
        const { data: subcommand, code } = StringValue.toString(args[2]);
        if (code != ResultCode.OK) return ERROR("invalid command name");
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

const ENSEMBLE_COMMAND_PREFIX = (name, args) =>
  `${StringValue.toString(name, "<ensemble>").data}${args ? " " + args : ""}`;
class EnsembleCommand implements Command {
  readonly metacommand: EnsembleMetacommand;
  constructor(metacommand: EnsembleMetacommand) {
    this.metacommand = metacommand;
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.metacommand);
    const minArgs = this.metacommand.argspec.argspec.nbRequired + 1;
    if (args.length < minArgs)
      return ARITY_ERROR(
        ENSEMBLE_COMMAND_PREFIX(args[0], this.metacommand.argspec.usage()) +
          " ?subcommand? ?arg ...?"
      );
    const ensembleArgs = [];
    const getargs = (_name, value) => {
      ensembleArgs.push(value);
      return OK(value);
    };
    const result = this.metacommand.argspec.applyArguments(
      scope,
      args.slice(1, minArgs),
      0,
      getargs
    );
    if (result.code != ResultCode.OK) return result;
    if (args.length == minArgs) {
      return OK(TUPLE(ensembleArgs));
    }
    const { data: subcommand, code } = StringValue.toString(args[minArgs]);
    if (code != ResultCode.OK) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length != minArgs + 1) {
        return ARITY_ERROR(
          ENSEMBLE_COMMAND_PREFIX(args[0], this.metacommand.argspec.usage()) +
            " subcommands"
        );
      }
      return OK(
        LIST([
          args[minArgs],
          ...this.metacommand.scope.getLocalCommands().map((name) => STR(name)),
        ])
      );
    }
    if (!this.metacommand.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const command = this.metacommand.scope.resolveNamedCommand(subcommand);
    const cmdline = [
      new EnsembleCommandValue(command),
      ...ensembleArgs,
      ...args.slice(minArgs + 1),
    ];
    return YIELD(new DeferredValue(TUPLE(cmdline), scope));
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip
      ? this.metacommand.argspec.usage(skip - 1)
      : ENSEMBLE_COMMAND_PREFIX(args[0], this.metacommand.argspec.usage());
    const signature = [prefix, usage].filter(Boolean).join(" ");
    const minArgs = this.metacommand.argspec.argspec.nbRequired + 1;
    if (args.length <= minArgs) {
      return OK(STR(signature + " ?subcommand? ?arg ...?"));
    }
    const { data: subcommand, code } = StringValue.toString(args[minArgs]);
    if (code != ResultCode.OK) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length > minArgs + 1) {
        return ARITY_ERROR(signature + " subcommands");
      }
      return OK(STR(signature + " subcommands"));
    }
    if (!this.metacommand.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const command = this.metacommand.scope.resolveNamedCommand(subcommand);
    if (!command.help) return ERROR(`no help for subcommand "${subcommand}"`);
    return command.help(
      [args[minArgs], ...args.slice(1, minArgs), ...args.slice(minArgs + 1)],
      {
        prefix: signature + " " + subcommand,
        skip: minArgs,
      }
    );
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
      const metacommand = new EnsembleMetacommand(
        state.subscope,
        state.argspec
      );
      if (state.name) {
        const result = state.scope.registerCommand(
          state.name,
          metacommand.ensemble
        );
        if (result.code != ResultCode.OK) return result;
      }
      return OK(result.code == ResultCode.RETURN ? result.value : metacommand);
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
