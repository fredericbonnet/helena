/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/commands";
import {
  Value,
  ScriptValue,
  ValueType,
  LIST,
  STR,
  TUPLE,
  StringValue,
  CommandValue,
  TupleValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Scope } from "./core";
import { ArgspecValue } from "./argspecs";
import {
  INVALID_SUBCOMMAND_ERROR,
  Subcommands,
  UNKNOWN_SUBCOMMAND_ERROR,
} from "./subcommands";

export class EnsembleMetacommand implements Command {
  readonly value: Value;
  readonly ensemble: EnsembleCommand;
  constructor(ensemble: EnsembleCommand) {
    this.value = new CommandValue(this);
    this.ensemble = ensemble;
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "eval",
    "call",
    "argspec",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    return EnsembleMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<metacommand> subcommands");
        return OK(EnsembleMetacommand.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<metacommand> eval body");
        const body = args[2];
        let program;
        switch (body.type) {
          case ValueType.SCRIPT:
            program = this.ensemble.scope.compileScriptValue(
              body as ScriptValue
            );
            break;
          case ValueType.TUPLE:
            program = this.ensemble.scope.compileTupleValue(body as TupleValue);
            break;
          default:
            return ERROR("body must be a script or tuple");
        }
        return ContinuationValue.create(this.ensemble.scope, program);
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<metacommand> call cmdname ?arg ...?");
        const [result, subcommand] = StringValue.toString(args[2]);
        if (result.code != ResultCode.OK) return ERROR("invalid command name");
        if (!this.ensemble.scope.hasLocalCommand(subcommand))
          return ERROR(`unknown command "${subcommand}"`);
        const command = this.ensemble.scope.resolveNamedCommand(subcommand);
        const cmdline = [new CommandValue(command), ...args.slice(3)];
        const program = scope.compileArgs(...cmdline);
        return ContinuationValue.create(scope, program);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<metacommand> argspec");
        return OK(this.ensemble.argspec);
      },
    });
  }
  help(args: Value[]): Result {
    if (args.length == 1)
      return OK(STR("<metacommand> ?subcommand? ?arg ...?"));

    return EnsembleMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length > 2) return ARITY_ERROR("<metacommand> subcommands");
        return OK(STR("<metacommand> subcommands"));
      },
      eval: () => {
        if (args.length > 3) return ARITY_ERROR("<metacommand> eval body");
        return OK(STR("<metacommand> eval body"));
      },
      call: () => {
        return OK(STR("<metacommand> call cmdname ?arg ...?"));
      },
      argspec: () => {
        if (args.length > 2) return ARITY_ERROR("<metacommand> argspec");
        return OK(STR("<metacommand> argspec"));
      },
    });
  }
}

const ENSEMBLE_COMMAND_PREFIX = (name, args) =>
  `${StringValue.toString(name, "<ensemble>")[1]}${args ? " " + args : ""}`;
export class EnsembleCommand implements Command {
  readonly metacommand: EnsembleMetacommand;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  constructor(scope: Scope, argspec: ArgspecValue) {
    this.scope = scope;
    this.argspec = argspec;
    this.metacommand = new EnsembleMetacommand(this);
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.metacommand.value);
    const minArgs = this.argspec.argspec.nbRequired + 1;
    if (args.length < minArgs)
      return ARITY_ERROR(
        ENSEMBLE_COMMAND_PREFIX(args[0], this.argspec.usage()) +
          " ?subcommand? ?arg ...?"
      );
    const ensembleArgs = [];
    const getargs = (_name, value) => {
      ensembleArgs.push(value);
      return OK(value);
    };
    const result = this.argspec.applyArguments(
      scope,
      args.slice(1, minArgs),
      0,
      getargs
    );
    if (result.code != ResultCode.OK) return result;
    if (args.length == minArgs) {
      return OK(TUPLE(ensembleArgs));
    }
    const [result2, subcommand] = StringValue.toString(args[minArgs]);
    if (result2.code != ResultCode.OK) return INVALID_SUBCOMMAND_ERROR();
    if (subcommand == "subcommands") {
      if (args.length != minArgs + 1) {
        return ARITY_ERROR(
          ENSEMBLE_COMMAND_PREFIX(args[0], this.argspec.usage()) +
            " subcommands"
        );
      }
      return OK(
        LIST([
          args[minArgs],
          ...this.scope.getLocalCommands().map((name) => STR(name)),
        ])
      );
    }
    if (!this.scope.hasLocalCommand(subcommand))
      return UNKNOWN_SUBCOMMAND_ERROR(subcommand);
    const command = this.scope.resolveNamedCommand(subcommand);
    const cmdline = [
      new CommandValue(command),
      ...ensembleArgs,
      ...args.slice(minArgs + 1),
    ];
    const program = scope.compileArgs(...cmdline);
    return ContinuationValue.create(scope, program);
  }
  /** @override */
  help(
    args: Value[],
    { prefix, skip }: { prefix?: string; skip?: number } = {}
  ) {
    const usage = skip
      ? this.argspec.usage(skip - 1)
      : ENSEMBLE_COMMAND_PREFIX(args[0], this.argspec.usage());
    const signature = [prefix, usage].filter(Boolean).join(" ");
    const minArgs = this.argspec.argspec.nbRequired + 1;
    if (args.length <= minArgs) {
      return OK(STR(signature + " ?subcommand? ?arg ...?"));
    }
    const [result, subcommand] = StringValue.toString(args[minArgs]);
    if (result.code != ResultCode.OK) return INVALID_SUBCOMMAND_ERROR();
    if (subcommand == "subcommands") {
      if (args.length > minArgs + 1) {
        return ARITY_ERROR(signature + " subcommands");
      }
      return OK(STR(signature + " subcommands"));
    }
    if (!this.scope.hasLocalCommand(subcommand))
      return UNKNOWN_SUBCOMMAND_ERROR(subcommand);
    const command = this.scope.resolveNamedCommand(subcommand);
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
export const ensembleCmd: Command = {
  execute: (args, scope: Scope) => {
    let name, specs, body;
    switch (args.length) {
      case 3:
        [, specs, body] = args;
        break;
      case 4:
        [, name, specs, body] = args;
        break;
      default:
        return ARITY_ERROR(ENSEMBLE_SIGNATURE);
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const [result, argspec] = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    if (argspec.argspec.isVariadic())
      return ERROR("ensemble arguments cannot be variadic");

    const subscope = scope.newChildScope();
    const program = subscope.compileScriptValue(body as ScriptValue);
    return ContinuationValue.create(subscope, program, (result) => {
      switch (result.code) {
        case ResultCode.OK:
        case ResultCode.RETURN: {
          const ensemble = new EnsembleCommand(subscope, argspec);
          if (name) {
            const result = scope.registerCommand(name, ensemble);
            if (result.code != ResultCode.OK) return result;
          }
          return OK(
            result.code == ResultCode.RETURN
              ? result.value
              : ensemble.metacommand.value
          );
        }
        case ResultCode.ERROR:
          return result;
        default:
          return ERROR("unexpected " + RESULT_CODE_NAME(result));
      }
    });
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(ENSEMBLE_SIGNATURE);
    return OK(STR(ENSEMBLE_SIGNATURE));
  },
};
