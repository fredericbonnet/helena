/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import {
  ERROR,
  OK,
  Result,
  ResultCode,
  YIELD,
  YIELD_BACK,
} from "../core/results";
import {
  BooleanValue,
  NIL,
  ScriptValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Process, Scope } from "./core";
import { executeCondition, resumeCondition } from "./logic";

type WhileState = {
  step: "beforeTest" | "inTest" | "afterTest" | "beforeBody" | "inBody";
  test: Value;
  testResult?: Result;
  program: Program;
  process?: Process;
  result: Result;
};
class WhileCommand implements Command {
  execute(args, scope: Scope) {
    let test, body: Value;
    switch (args.length) {
      case 3:
        [, test, body] = args;
        break;
      default:
        return ARITY_ERROR("while test body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
    const program = scope.compile((body as ScriptValue).script);
    return this.run(
      { step: "beforeTest", test, program, result: OK(NIL) },
      scope
    );
  }
  resume(result: Result, scope: Scope) {
    const state = result.data as WhileState;
    switch (state.step) {
      case "inTest":
        state.testResult = YIELD_BACK(state.testResult, result.value);
        break;
      case "inBody":
        state.process.yieldBack(result.value);
        break;
    }
    return this.run(state, scope);
  }
  run(state: WhileState, scope: Scope) {
    for (;;) {
      switch (state.step) {
        case "beforeTest":
          state.testResult = executeCondition(scope, state.test);
          state.step = "inTest";
          if (state.testResult.code == ResultCode.YIELD)
            return YIELD(state.testResult.value, state);
          state.step = "afterTest";
          break;
        case "inTest":
          state.testResult = resumeCondition(state.testResult);
          if (state.testResult.code == ResultCode.YIELD)
            return YIELD(state.testResult.value, state);
          state.step = "afterTest";
          break;
        case "afterTest":
          if (state.testResult.code != ResultCode.OK) return state.testResult;
          if (!(state.testResult.value as BooleanValue).value)
            return state.result;
          state.step = "beforeBody";
          break;
        case "beforeBody":
          state.process = scope.prepareProcess(state.program);
          state.step = "inBody";
          break;
        case "inBody": {
          const result = state.process.run();
          if (result.code == ResultCode.YIELD)
            return YIELD(result.value, state);
          state.step = "beforeTest";
          if (result.code == ResultCode.BREAK) return state.result;
          if (result.code == ResultCode.CONTINUE) continue;
          if (result.code != ResultCode.OK) return result;
          state.result = result;
          break;
        }
      }
    }
  }
}
export const whileCmd = new WhileCommand();

class IfState {
  args: Value[];
  i: number;
  step: "beforeTest" | "inTest" | "afterTest" | "beforeBody" | "inBody";
  testResult?: Result;
  process?: Process;
}
class IfCommand implements Command {
  execute(args, scope: Scope) {
    const checkResult = this.checkArgs(args);
    if (checkResult.code != ResultCode.OK) return checkResult;
    return this.run({ args, i: 0, step: "beforeTest" }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as IfState;
    switch (state.step) {
      case "inTest":
        state.testResult = YIELD_BACK(state.testResult, result.value);
        break;
      case "inBody":
        state.process.yieldBack(result.value);
        break;
    }
    return this.run(state, scope);
  }
  run(state: IfState, scope: Scope): Result {
    while (state.i < state.args.length) {
      switch (state.step) {
        case "beforeTest":
          if (state.args[state.i].asString() == "else") {
            state.step = "beforeBody";
          } else {
            const test = state.args[state.i + 1];
            state.testResult = executeCondition(scope, test);
            state.step = "inTest";
            if (state.testResult.code == ResultCode.YIELD)
              return YIELD(state.testResult.value, state);
            state.step = "afterTest";
          }
          break;
        case "inTest":
          state.testResult = resumeCondition(state.testResult);
          if (state.testResult.code == ResultCode.YIELD)
            return YIELD(state.testResult.value, state);
          state.step = "afterTest";
          break;
        case "afterTest":
          if (state.testResult.code != ResultCode.OK) return state.testResult;
          if (!(state.testResult.value as BooleanValue).value) {
            state.step = "beforeTest";
            state.i += 3;
            continue;
          }
          state.step = "beforeBody";
          break;
        case "beforeBody": {
          const body =
            state.args[state.i].asString() == "else"
              ? state.args[state.i + 1]
              : state.args[state.i + 2];
          if (body.type != ValueType.SCRIPT)
            return ERROR("body must be a script");
          state.process = scope.prepareScriptValue(body as ScriptValue);
          state.step = "inBody";
          break;
        }
        case "inBody": {
          const result = state.process.run();
          if (result.code == ResultCode.YIELD)
            return YIELD(result.value, state);
          return result;
        }
      }
    }
    return OK(NIL);
  }
  checkArgs(args: Value[]): Result {
    let i = 3;
    while (i < args.length) {
      const keyword = args[i].asString();
      switch (keyword) {
        case "elseif":
          i += 3;
          break;
        case "else":
          i += 2;
          break;
        default:
          return ERROR(`invalid keyword "${keyword}"`);
      }
    }
    if (i == args.length) return OK(NIL);
    return ARITY_ERROR("if test body ?elseif test body ...? ?else? ?body?");
  }
}
export const ifCmd = new IfCommand();
