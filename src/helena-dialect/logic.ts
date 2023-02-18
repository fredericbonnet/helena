/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ResultCode,
  ERROR,
  YIELD,
  YIELD_BACK,
} from "../core/results";
import { Command } from "../core/command";
import {
  BooleanValue,
  FALSE,
  NIL,
  ScriptValue,
  TRUE,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Process, Scope } from "./core";

export const trueCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(TRUE);
    const subcommand = args[1].asString?.();
    if (subcommand == null) return ERROR("invalid subcommand name");
    switch (subcommand) {
      case "?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("true ? arg ?arg?");
        return OK(args[2]);
      case "!?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("true !? arg ?arg?");
        return OK(args.length == 4 ? args[3] : NIL);
      default:
        return ERROR(`unknown subcommand "${subcommand}"`);
    }
  },
};
export const falseCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(FALSE);
    const subcommand = args[1].asString?.();
    if (subcommand == null) return ERROR("invalid subcommand name");
    switch (subcommand) {
      case "?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("false ? arg ?arg?");
        return OK(args.length == 4 ? args[3] : NIL);
      case "!?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("false !? arg ?arg?");
        return OK(args[2]);
      default:
        return ERROR(`unknown subcommand "${subcommand}"`);
    }
  },
};

export const notCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    if (args.length != 2) return ARITY_ERROR("! arg");
    const result = executeCondition(scope, args[1]);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
  resume(result: Result) {
    result = resumeCondition(result);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
};

type AndCommandState = {
  args: Value[];
  i: number;
  result?: Result;
};
class AndCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR("&& arg ?arg ...?");
    return this.run({ args, i: 1 }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as AndCommandState;
    state.result = YIELD_BACK(state.result, result.value);
    return this.run(result.data as AndCommandState, scope);
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

type OrCommandState = {
  args: Value[];
  i: number;
  result?: Result;
};
class OrCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR("|| arg ?arg ...?");
    return this.run({ args, i: 1 }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as OrCommandState;
    state.result = YIELD_BACK(state.result, result.value);
    return this.run(result.data as OrCommandState, scope);
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

  scope.registerNamedCommand("!", notCmd);
  scope.registerNamedCommand("&&", andCmd);
  scope.registerNamedCommand("||", orCmd);
}
