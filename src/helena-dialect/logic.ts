/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ResultCode, YIELD, YIELD_BACK } from "../core/results";
import { Command } from "../core/command";
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
import { Process, Scope } from "./core";
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
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.ensemble.metacommand.value);
    if (args.length == 2) return BooleanValue.fromValue(args[1]);
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const NOT_SIGNATURE = "! arg";
export const notCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    if (args.length != 2) return ARITY_ERROR(NOT_SIGNATURE);
    const result = executeCondition(scope, args[1]);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
  resume(result: Result) {
    result = resumeCondition(result);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
  help(args: Value[]): Result {
    if (args.length > 2) return ARITY_ERROR(NOT_SIGNATURE);
    return OK(STR(NOT_SIGNATURE));
  },
};

const AND_SIGNATURE = "&& arg ?arg ...?";
type AndCommandState = {
  args: Value[];
  i: number;
  result?: Result;
};
class AndCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR(AND_SIGNATURE);
    return this.run({ args, i: 1 }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as AndCommandState;
    state.result = YIELD_BACK(state.result, result.value);
    return this.run(result.data as AndCommandState, scope);
  }
  help() {
    return OK(STR(AND_SIGNATURE));
  }
  private run(state: AndCommandState, scope: Scope) {
    let r = TRUE;
    while (state.i < state.args.length) {
      state.result = state.result
        ? resumeCondition(state.result)
        : executeCondition(scope, state.args[state.i]);
      if (state.result.code == ResultCode.YIELD) {
        return YIELD(state.result.value, state);
      }
      if (state.result.code != ResultCode.OK) return state.result;
      if (!(state.result.value as BooleanValue).value) {
        r = FALSE;
        break;
      }
      delete state.result;
      state.i++;
    }

    return OK(r);
  }
}
const andCmd: Command = new AndCommand();

const OR_SIGNATURE = "|| arg ?arg ...?";
type OrCommandState = {
  args: Value[];
  i: number;
  result?: Result;
};
class OrCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR(OR_SIGNATURE);
    return this.run({ args, i: 1 }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as OrCommandState;
    state.result = YIELD_BACK(state.result, result.value);
    return this.run(result.data as OrCommandState, scope);
  }
  help() {
    return OK(STR(OR_SIGNATURE));
  }
  private run(state: OrCommandState, scope: Scope) {
    let r = FALSE;
    while (state.i < state.args.length) {
      state.result = state.result
        ? resumeCondition(state.result)
        : executeCondition(scope, state.args[state.i]);
      if (state.result.code == ResultCode.YIELD) {
        return YIELD(state.result.value, state);
      }
      if (state.result.code != ResultCode.OK) return state.result;
      if ((state.result.value as BooleanValue).value) {
        r = TRUE;
        break;
      }
      delete state.result;
      state.i++;
    }

    return OK(r);
  }
}
const orCmd: Command = new OrCommand();

export function executeCondition(scope: Scope, value: Value): Result {
  if (value.type == ValueType.SCRIPT) {
    const process = scope.prepareScriptValue(value as ScriptValue);
    return runCondition(process);
  }
  return BooleanValue.fromValue(value);
}
export function resumeCondition(result: Result) {
  const process = result.data as Process;
  process.yieldBack(result.value);
  return runCondition(process);
}
function runCondition(process: Process) {
  const result = process.run();
  if (result.code == ResultCode.YIELD) return YIELD(result.value, process);
  if (result.code != ResultCode.OK) return result;
  return BooleanValue.fromValue(result.value);
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
