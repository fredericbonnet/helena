/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ResultCode } from "../core/results";
import { Command } from "../core/commands";
import {
  BooleanValue,
  FALSE,
  LIST,
  NIL,
  STR,
  ScriptValue,
  TRUE,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Scope } from "./core";
import { Subcommands } from "./subcommands";
import { EnsembleCommand } from "./ensembles";
import { ArgspecValue } from "./argspecs";

const booleanSubcommands = new Subcommands(["subcommands", "?", "!?"]);

export const trueCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(TRUE);
    return booleanSubcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("true subcommands");
        return OK(booleanSubcommands.list);
      },
      "?": () => {
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("true ? arg ?arg?");
        return OK(args[2]);
      },
      "!?": () => {
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("true !? arg ?arg?");
        return OK(args.length == 4 ? args[3] : NIL);
      },
    });
  },
  help(args: Value[]): Result {
    if (args.length == 1) return OK(STR("true ?subcommand?"));
    return booleanSubcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length > 2) return ARITY_ERROR("true subcommands");
        return OK(STR("true subcommands"));
      },
      "?": () => {
        if (args.length > 4) return ARITY_ERROR("true ? arg ?arg?");
        return OK(STR("true ? arg ?arg?"));
      },
      "!?": () => {
        if (args.length > 4) return ARITY_ERROR("true !? arg ?arg?");
        return OK(STR("true !? arg ?arg?"));
      },
    });
  },
};
export const falseCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(FALSE);
    return booleanSubcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("false subcommands");
        return OK(booleanSubcommands.list);
      },
      "?": () => {
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("false ? arg ?arg?");
        return OK(args.length == 4 ? args[3] : NIL);
      },
      "!?": () => {
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("false !? arg ?arg?");
        return OK(args[2]);
      },
    });
  },
  help(args: Value[]): Result {
    if (args.length == 1) return OK(STR("false ?subcommand?"));
    return booleanSubcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length > 2) return ARITY_ERROR("false subcommands");
        return OK(STR("false subcommands"));
      },
      "?": () => {
        if (args.length > 4) return ARITY_ERROR("false ? arg ?arg?");
        return OK(STR("false ? arg ?arg?"));
      },
      "!?": () => {
        if (args.length > 4) return ARITY_ERROR("false !? arg ?arg?");
        return OK(STR("false !? arg ?arg?"));
      },
    });
  },
};

class BoolCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = scope.newChildScope();
    const [, argspec] = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return BooleanValue.fromValue(args[1])[0];
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const NOT_SIGNATURE = "! arg";
const notCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    if (args.length != 2) return ARITY_ERROR(NOT_SIGNATURE);
    return executeCondition(scope, args[1], ([result, b]) => {
      if (result.code != ResultCode.OK) return result;
      return b ? OK(FALSE) : OK(TRUE);
    });
  },
  help(args: Value[]): Result {
    if (args.length > 2) return ARITY_ERROR(NOT_SIGNATURE);
    return OK(STR(NOT_SIGNATURE));
  },
};

const AND_SIGNATURE = "&& arg ?arg ...?";
const andCmd: Command = {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR(AND_SIGNATURE);
    let i = 1;
    const callback = ([result, b]) => {
      if (result.code != ResultCode.OK) return result;
      if (!b) return OK(FALSE);
      if (++i >= args.length) return OK(TRUE);
      return executeCondition(scope, args[i], callback);
    };
    return executeCondition(scope, args[i], callback);
  },
  help() {
    return OK(STR(AND_SIGNATURE));
  },
};

const OR_SIGNATURE = "|| arg ?arg ...?";
const orCmd: Command = {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR(OR_SIGNATURE);
    let i = 1;
    const callback = ([result, b]: [Result, boolean?]) => {
      if (result.code != ResultCode.OK) return result;
      if (b) return OK(TRUE);
      if (++i >= args.length) return OK(FALSE);
      return executeCondition(scope, args[i], callback);
    };
    return executeCondition(scope, args[i], callback);
  },
  help() {
    return OK(STR(OR_SIGNATURE));
  },
};

export function executeCondition(
  scope: Scope,
  value: Value,
  callback: ([result, b]: [Result, boolean?]) => Result
): Result {
  if (value.type == ValueType.SCRIPT) {
    const program = scope.compileScriptValue(value as ScriptValue);
    return ContinuationValue.create(scope, program, (result) => {
      if (result.code != ResultCode.OK) return result;
      return callback(BooleanValue.toBoolean(result.value));
    });
  }
  // TODO ensure tail call in trampoline, or unroll in caller
  return callback(BooleanValue.toBoolean(value));
}

export function registerLogicCommands(scope: Scope) {
  scope.registerNamedCommand("true", trueCmd);
  scope.registerNamedCommand("false", falseCmd);

  const boolCommand = new BoolCommand(scope);
  scope.registerNamedCommand("bool", boolCommand);

  scope.registerNamedCommand("!", notCmd);
  scope.registerNamedCommand("&&", andCmd);
  scope.registerNamedCommand("||", orCmd);
}
