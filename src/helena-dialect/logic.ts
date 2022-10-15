/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, Command, ResultCode, ERROR, YIELD } from "../core/command";
import { ExecutionContext, Program } from "../core/compiler";
import {
  BooleanValue,
  FALSE,
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

export const trueCmd = (): Command => ({
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(TRUE);
    throw new Error("TODO implement infix operators"); // TODO
  },
});
export const falseCmd = (): Command => ({
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(FALSE);
    throw new Error("TODO implement infix operators"); // TODO
  },
});

export const notCmd = (scope: Scope): Command => ({
  execute(args: Value[]): Result {
    if (args.length != 2) return ARITY_ERROR("! arg");
    const result = executeCondition(scope, args[1]);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
  resume(result: Result) {
    result = runCondition(scope, result.state as ConditionState);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
});

type AndCommandState = {
  args: Value[];
  i: number;
  conditionState?: ConditionState;
};
class AndCommand implements Command {
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.scope = scope;
  }
  execute(args) {
    if (args.length < 2) return ARITY_ERROR("&& arg ?arg ...?");
    return this.run({ args, i: 1 });
  }
  resume(result: Result): Result {
    return this.run(result.state as AndCommandState);
  }
  run(state: AndCommandState) {
    let r = TRUE;
    while (state.i < state.args.length) {
      const result = state.conditionState
        ? runCondition(this.scope, state.conditionState)
        : executeCondition(this.scope, state.args[state.i]);
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
const andCmd = (scope: Scope): Command => new AndCommand(scope);

type OrCommandState = {
  args: Value[];
  i: number;
  conditionState?: ConditionState;
};
class OrCommand implements Command {
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.scope = scope;
  }
  execute(args) {
    if (args.length < 2) return ARITY_ERROR("|| arg ?arg ...?");
    return this.run({ args, i: 1 });
  }
  resume(result: Result): Result {
    return this.run(result.state as OrCommandState);
  }
  run(state: OrCommandState) {
    let r = FALSE;
    while (state.i < state.args.length) {
      const result = state.conditionState
        ? runCondition(this.scope, state.conditionState)
        : executeCondition(this.scope, state.args[state.i]);
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
const orCmd = (scope: Scope): Command => new OrCommand(scope);

type ConditionState = {
  program: Program;
  context: ExecutionContext;
};
function executeCondition(scope: Scope, value: Value): Result {
  if (value.type == ValueType.SCRIPT) {
    const script = (value as ScriptValue).script;
    const program = scope.compile(script);
    const context = new ExecutionContext();
    return runCondition(scope, { program, context });
  }
  if (!BooleanValue.isBoolean(value)) return BOOLEAN_ERROR(value);
  return OK(BooleanValue.fromValue(value));
}
function runCondition(scope: Scope, state: ConditionState) {
  const result = scope.execute(state.program, state.context);
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
