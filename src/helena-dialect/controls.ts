/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Process, Program } from "../core/compiler";
import { ERROR, OK, Result, ResultCode, YIELD } from "../core/results";
import {
  BooleanValue,
  NIL,
  ScriptValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { executeCondition, resumeCondition } from "./logic";

type WhileState = {
  step: "beforeTest" | "inTest" | "beforeBody" | "inBody";
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
        state.testResult = { ...state.testResult, value: result.value };
        break;
      case "inBody":
        state.process.result = { ...state.process.result, value: result.value };
        break;
    }
    return this.run(state, scope);
  }
  run(state: WhileState, scope: Scope) {
    for (;;) {
      let result: Result;
      switch (state.step) {
        case "beforeTest":
          result = executeCondition(scope, state.test);
          state.testResult = result;
          state.step = "inTest";
          break;
        case "inTest":
          result = resumeCondition(state.testResult, scope);
          state.testResult = result;
          break;
        case "beforeBody":
          state.process = new Process();
          result = scope.execute(state.program, state.process);
          state.step = "inBody";
          break;
        case "inBody":
          result = scope.execute(state.program, state.process);
          break;
      }
      if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
      if (state.step == "inTest") {
        state.step = "beforeBody";
        if (result.code != ResultCode.OK) return result;
        if (!(result.value as BooleanValue).value) return state.result;
      } else if (state.step == "inBody") {
        state.step = "beforeTest";
        if (result.code == ResultCode.BREAK) break;
        if (result.code == ResultCode.CONTINUE) continue;
        state.result = result;
        if (result.code != ResultCode.OK) return result;
      }
    }
    return state.result;
  }
}
export const whileCmd = new WhileCommand();
