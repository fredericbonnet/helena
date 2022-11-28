/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import { ERROR, OK, Result, ResultCode, YIELD } from "../core/results";
import {
  BooleanValue,
  NIL,
  ScriptValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Process, Scope } from "./core";
import { valueToArray } from "./lists";

type WhileState = {
  step: "beforeTest" | "inTest" | "afterTest" | "beforeBody" | "inBody";
  test: Value;
  testProgram?: Program;
  result?: Result;
  program: Program;
  process?: Process;
  lastResult: Result;
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
    let testProgram;
    if (test.type == ValueType.SCRIPT) {
      testProgram = scope.compile((test as ScriptValue).script);
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
    const program = scope.compile((body as ScriptValue).script);
    return this.run(
      { step: "beforeTest", test, testProgram, program, lastResult: OK(NIL) },
      scope
    );
  }
  resume(result: Result, scope: Scope) {
    const state = result.data as WhileState;
    switch (state.step) {
      case "inTest":
      case "inBody":
        state.process.yieldBack(result.value);
        break;
    }
    return this.run(state, scope);
  }
  private run(state: WhileState, scope: Scope) {
    for (;;) {
      switch (state.step) {
        case "beforeTest": {
          state.result = this.executeTest(state, scope);
          state.step = "inTest";
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          state.step = "afterTest";
          break;
        }
        case "inTest": {
          state.result = this.resumeTest(state);
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          state.step = "afterTest";
          break;
        }
        case "afterTest":
          if (state.result.code != ResultCode.OK) return state.result;
          if (!(state.result.value as BooleanValue).value)
            return state.lastResult;
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
          if (result.code == ResultCode.BREAK) return state.lastResult;
          if (result.code == ResultCode.CONTINUE) continue;
          if (result.code != ResultCode.OK) return result;
          state.lastResult = result;
          break;
        }
      }
    }
  }
  private executeTest(state: WhileState, scope: Scope) {
    let test = state.test;
    if (test.type == ValueType.SCRIPT) {
      state.process = scope.prepareProcess(state.testProgram);
      const result = state.process.run();
      if (result.code != ResultCode.OK) return result;
      test = result.value;
    }
    return BooleanValue.fromValue(test);
  }
  private resumeTest(state: WhileState) {
    const result = state.process.run();
    if (result.code != ResultCode.OK) return;
    return BooleanValue.fromValue(result.value);
  }
}
export const whileCmd = new WhileCommand();

class IfState {
  args: Value[];
  i: number;
  step: "beforeTest" | "inTest" | "afterTest" | "beforeBody" | "inBody";
  result?: Result;
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
      case "inBody":
        state.process.yieldBack(result.value);
        break;
    }
    return this.run(state, scope);
  }
  private run(state: IfState, scope: Scope): Result {
    while (state.i < state.args.length) {
      switch (state.step) {
        case "beforeTest":
          if (state.args[state.i].asString() == "else") {
            state.step = "beforeBody";
          } else {
            state.result = this.executeTest(state, scope);
            state.step = "inTest";
            if (state.result.code == ResultCode.YIELD)
              return YIELD(state.result.value, state);
            state.step = "afterTest";
          }
          break;
        case "inTest":
          state.result = this.resumeTest(state);
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          state.step = "afterTest";
          break;
        case "afterTest":
          if (state.result.code != ResultCode.OK) return state.result;
          if (!(state.result.value as BooleanValue).value) {
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
  private executeTest(state: IfState, scope: Scope) {
    let test = state.args[state.i + 1];
    if (test.type == ValueType.SCRIPT) {
      state.process = scope.prepareScriptValue(test as ScriptValue);
      const result = state.process.run();
      if (result.code != ResultCode.OK) return result;
      test = result.value;
    }
    return BooleanValue.fromValue(test);
  }
  private resumeTest(state: IfState) {
    const result = state.process.run();
    if (result.code != ResultCode.OK) return;
    return BooleanValue.fromValue(result.value);
  }
  private checkArgs(args: Value[]): Result {
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

class WhenState {
  command?: Value;
  cases: Value[];
  i: number;
  step:
    | "beforeCommand"
    | "inCommand"
    | "afterCommand"
    | "beforeTest"
    | "inTest"
    | "afterTest"
    | "beforeBody"
    | "inBody";
  process?: Process;
  result?: Result;
}
class WhenCommand implements Command {
  execute(args, scope: Scope) {
    let command, casesBody;
    switch (args.length) {
      case 2:
        [, casesBody] = args;
        break;
      case 3:
        [, command, casesBody] = args;
        break;
      default:
        return ARITY_ERROR("when ?command? {?test body ...? ?default?}");
    }
    const { data: cases, ...result } = valueToArray(casesBody);
    if (result.code != ResultCode.OK) return result;
    if (cases.length == 0) return OK(NIL);
    return this.run({ command, cases, i: 0, step: "beforeCommand" }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as WhenState;
    switch (state.step) {
      case "inCommand":
      case "inTest":
      case "inBody":
        state.process.yieldBack(result.value);
        break;
    }
    return this.run(state, scope);
  }
  private run(state: WhenState, scope: Scope): Result {
    while (state.i < state.cases.length) {
      switch (state.step) {
        case "beforeCommand":
          if (state.i == state.cases.length - 1) {
            state.step = "beforeBody";
          } else {
            state.result = this.getCommand(state, scope);
            state.step = "inCommand";
            if (state.result.code == ResultCode.YIELD)
              return YIELD(state.result.value, state);
            state.step = "afterCommand";
          }
          break;
        case "inCommand":
          state.result = state.process.run();
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          state.step = "afterCommand";
          break;
        case "afterCommand":
          if (state.result.code != ResultCode.OK) return state.result;
          state.result = this.getTest(state, state.result.value);
          state.step = "beforeTest";
          break;
        case "beforeTest":
          state.result = this.executeTest(state.result.value, state, scope);
          state.step = "inTest";
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          state.step = "afterTest";
          break;
        case "inTest":
          state.result = this.resumeTest(state);
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          state.step = "afterTest";
          break;
        case "afterTest":
          if (state.result.code != ResultCode.OK) return state.result;
          if (!(state.result.value as BooleanValue).value) {
            state.step = "beforeCommand";
            state.i += 2;
            continue;
          }
          state.step = "beforeBody";
          break;
        case "beforeBody": {
          const body =
            state.i == state.cases.length - 1
              ? state.cases[state.i]
              : state.cases[state.i + 1];
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
  private getCommand(state: WhenState, scope): Result {
    if (!state.command) return OK(NIL);
    if (state.command.type == ValueType.SCRIPT) {
      state.process = scope.prepareScriptValue(state.command as ScriptValue);
      return state.process.run();
    }
    return OK(state.command);
  }
  private getTest(state: WhenState, command: Value) {
    const test = state.cases[state.i];
    if (command == NIL) return OK(test);
    switch (test.type) {
      case ValueType.TUPLE:
        return OK(new TupleValue([command, ...(test as TupleValue).values]));
      default:
        return OK(new TupleValue([command, test]));
    }
  }
  private executeTest(test: Value, state: WhenState, scope: Scope) {
    switch (test.type) {
      case ValueType.SCRIPT: {
        state.process = scope.prepareScriptValue(test as ScriptValue);
        const result = state.process.run();
        if (result.code != ResultCode.OK) return result;
        return BooleanValue.fromValue(result.value);
      }
      case ValueType.TUPLE: {
        state.process = scope.prepareTupleValue(test as TupleValue);
        const result = state.process.run();
        if (result.code != ResultCode.OK) return result;
        return BooleanValue.fromValue(result.value);
      }
      default:
        return BooleanValue.fromValue(test);
    }
  }
  private resumeTest(state: WhenState) {
    const result = state.process.run();
    if (result.code != ResultCode.OK) return result;
    return BooleanValue.fromValue(result.value);
  }
}
export const whenCmd = new WhenCommand();
