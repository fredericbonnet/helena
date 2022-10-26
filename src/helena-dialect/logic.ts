/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, Command, ResultCode, ERROR, YIELD } from "../core/command";
import { Process, Program } from "../core/compiler";
import {
  BooleanValue,
  FALSE,
  NIL,
  ScriptValue,
  StringValue,
  TRUE,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

const BOOLEAN_ERROR = (value: Value) =>
  ERROR(new StringValue(`invalid boolean "${value.asString()}"`));

export const trueCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(TRUE);
    const method = args[1].asString();
    switch (method) {
      case "?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("true ? arg ?arg?");
        return OK(args[2]);
      case "!?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("true !? arg ?arg?");
        return OK(args.length == 4 ? args[3] : NIL);
      default:
        return ERROR(new StringValue(`invalid method name "${method}"`));
    }
  },
};
export const falseCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(FALSE);
    const method = args[1].asString();
    switch (method) {
      case "?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("false ? arg ?arg?");
        return OK(args.length == 4 ? args[3] : NIL);
      case "!?":
        if (args.length < 3 || args.length > 4)
          return ARITY_ERROR("false !? arg ?arg?");
        return OK(args[2]);
      default:
        return ERROR(new StringValue(`invalid method name "${method}"`));
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
  resume(result: Result, scope: Scope) {
    result = runCondition(scope, result.state as ConditionState);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
};

type AndCommandState = {
  args: Value[];
  i: number;
  conditionState?: ConditionState;
};
class AndCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR("&& arg ?arg ...?");
    return this.run({ args, i: 1 }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    return this.run(result.state as AndCommandState, scope);
  }
  run(state: AndCommandState, scope: Scope) {
    let r = TRUE;
    while (state.i < state.args.length) {
      const result = state.conditionState
        ? runCondition(scope, state.conditionState)
        : executeCondition(scope, state.args[state.i]);
      if (result.code == ResultCode.YIELD) {
        state.conditionState = result.state as ConditionState;
        return YIELD(result.value, state);
      }
      delete state.conditionState;
      if (result.code != ResultCode.OK) return result;
      if (!(result.value as BooleanValue).value) {
        r = FALSE;
        break;
      }
      state.i++;
    }

    return OK(r);
  }
}
const andCmd: Command = new AndCommand();

type OrCommandState = {
  args: Value[];
  i: number;
  conditionState?: ConditionState;
};
class OrCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length < 2) return ARITY_ERROR("|| arg ?arg ...?");
    return this.run({ args, i: 1 }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    return this.run(result.state as OrCommandState, scope);
  }
  run(state: OrCommandState, scope: Scope) {
    let r = FALSE;
    while (state.i < state.args.length) {
      const result = state.conditionState
        ? runCondition(scope, state.conditionState)
        : executeCondition(scope, state.args[state.i]);
      if (result.code == ResultCode.YIELD) {
        state.conditionState = result.state as ConditionState;
        return YIELD(result.value, state);
      }
      delete state.conditionState;
      if (result.code != ResultCode.OK) return result;
      if ((result.value as BooleanValue).value) {
        r = TRUE;
        break;
      }
      state.i++;
    }

    return OK(r);
  }
}
const orCmd: Command = new OrCommand();

type ConditionState = {
  program: Program;
  process: Process;
};
function executeCondition(scope: Scope, value: Value): Result {
  if (value.type == ValueType.SCRIPT) {
    const script = (value as ScriptValue).script;
    const program = scope.compile(script);
    const process = new Process();
    return runCondition(scope, { program, process });
  }
  if (!BooleanValue.isBoolean(value)) return BOOLEAN_ERROR(value);
  return OK(BooleanValue.fromValue(value));
}
function runCondition(scope: Scope, state: ConditionState) {
  const result = scope.execute(state.program, state.process);
  if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
  if (result.code != ResultCode.OK) return result;
  if (!BooleanValue.isBoolean(result.value)) return BOOLEAN_ERROR(result.value);
  return OK(BooleanValue.fromValue(result.value));
}

export function registerLogicCommands(scope: Scope) {
  scope.registerCommand("true", trueCmd);
  scope.registerCommand("false", falseCmd);

  scope.registerCommand("!", notCmd);
  scope.registerCommand("&&", andCmd);
  scope.registerCommand("||", orCmd);
}
