/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
  YIELD,
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
import { ArgspecValue, USAGE_ARGSPEC } from "./argspecs";
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
        const command = this.ensemble.scope.resolveLocalCommand(subcommand);
        if (!command) return ERROR(`unknown command "${subcommand}"`);
        const cmdline = [command, ...args.slice(3)];
        const program = scope.compileArgs(cmdline);
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

const ENSEMBLE_COMMAND_PREFIX = (name, argspec, options?) =>
  USAGE_ARGSPEC(name, "<closure>", argspec, options);
type EnsembleSubcommandState = {
  subcommand: Command;
  result: Result;
};
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
        ENSEMBLE_COMMAND_PREFIX(args[0], this.argspec) +
          " ?subcommand? ?arg ...?"
      );
    if (args.length == minArgs) {
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
      return OK(TUPLE(ensembleArgs));
    }
    const [result2, subcommand] = StringValue.toString(args[minArgs]);
    if (result2.code != ResultCode.OK) return INVALID_SUBCOMMAND_ERROR();
    if (subcommand == "subcommands") {
      if (args.length != minArgs + 1) {
        return ARITY_ERROR(
          ENSEMBLE_COMMAND_PREFIX(args[0], this.argspec) + " subcommands"
        );
      }
      return OK(
        LIST([
          args[minArgs],
          ...this.scope.getLocalCommandNames().map((name) => STR(name)),
        ])
      );
    }
    const command = this.scope.resolveLocalCommand(subcommand);
    if (!command) return UNKNOWN_SUBCOMMAND_ERROR(subcommand);
    const cmdline: Value[] = [command];
    if (!this.argspec.argspec.hasGuards) {
      // If we have no guards to apply then can just copy the args over
      cmdline.push(...args.slice(1, minArgs));
    } else {
      const getargs = (_name, value) => {
        cmdline.push(value);
        return OK(value);
      };
      const result = this.argspec.applyArguments(
        scope,
        args.slice(1, minArgs),
        0,
        getargs
      );
      if (result.code != ResultCode.OK) return result;
    }
    cmdline.push(...args.slice(minArgs + 1));
    const result = command.command.execute(cmdline, scope);
    if (result.code == ResultCode.YIELD) {
      const state = {
        subcommand: command.command,
        result,
      } as EnsembleSubcommandState;
      return YIELD(result.value, state);
    }
    return result;
  }
  resume(result: Result, scope: Scope): Result {
    const { subcommand, result: subcommandResult } =
      result.data as EnsembleSubcommandState;
    if (!subcommand.resume) return OK(result.value);
    const result2 = subcommand.resume(
      { ...subcommandResult, value: result.value },
      scope
    );
    if (result2.code == ResultCode.YIELD)
      return YIELD(result2.value, { subcommand, result: result2 });
    return result2;
  }
  help(args: Value[], options?) {
    const signature = ENSEMBLE_COMMAND_PREFIX(args[0], this.argspec, options);
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
    const command = this.scope.resolveLocalCommand(subcommand);
    if (!command) return UNKNOWN_SUBCOMMAND_ERROR(subcommand);
    if (!command.command.help)
      return ERROR(`no help for subcommand "${subcommand}"`);
    return command.command.help(
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
    if (argspec.argspec.hasOptions())
      return ERROR("ensemble arguments cannot have options");

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
