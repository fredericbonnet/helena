/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import {
  CUSTOM_RESULT,
  CustomResultCode,
  ERROR,
  OK,
  Result,
  ResultCode,
  YIELD,
} from "../core/results";
import {
  BooleanValue,
  NIL,
  ScriptValue,
  StringValue,
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
    state.process.yieldBack(result.value);
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
const whileCmd = new WhileCommand();

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
    state.process.yieldBack(result.value);
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
    if (args.length == 2) return ERROR("wrong # args: missing if body");
    let i = 3;
    while (i < args.length) {
      const keyword = args[i].asString();
      switch (keyword) {
        case "elseif":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong # args: missing elseif test");
            case 2:
              return ERROR("wrong # args: missing elseif body");
            default:
              i += 3;
          }
          break;
        case "else":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong # args: missing else body");
            default:
              i += 2;
          }
          break;
        default:
          return ERROR(`invalid keyword "${keyword}"`);
      }
    }
    if (i == args.length) return OK(NIL);
    return ARITY_ERROR("if test body ?elseif test body ...? ?else? ?body?");
  }
}
const ifCmd = new IfCommand();

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
    state.process.yieldBack(result.value);
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
const whenCmd = new WhenCommand();

type CatchState = {
  args: Value[];
  step:
    | "beforeBody"
    | "inBody"
    | "beforeHandler"
    | "inHandler"
    | "afterHandler"
    | "beforeFinally"
    | "inFinally";
  bodyResult?: Result;
  bodyProcess?: Process;
  result?: Result;
  process?: Process;
};
class CatchCommand implements Command {
  execute(args: Value[], scope: Scope): Result {
    const checkResult = this.checkArgs(args);
    if (checkResult.code != ResultCode.OK) return checkResult;
    if (args.length == 2) {
      const body = args[1];
      if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
      const result = scope.executeScriptValue(body as ScriptValue);
      switch (result.code) {
        case ResultCode.OK:
          return OK(new TupleValue([new StringValue("ok"), result.value]));
        case ResultCode.RETURN:
          return OK(new TupleValue([new StringValue("return"), result.value]));
        case ResultCode.YIELD:
          return OK(new TupleValue([new StringValue("yield"), result.value]));
        case ResultCode.ERROR:
          return OK(new TupleValue([new StringValue("error"), result.value]));
        case ResultCode.BREAK:
          return OK(new TupleValue([new StringValue("break")]));
        case ResultCode.CONTINUE:
          return OK(new TupleValue([new StringValue("continue")]));
        default:
          return OK(
            new TupleValue([
              new StringValue((result.code as CustomResultCode).name),
            ])
          );
      }
    }
    return this.run({ step: "beforeBody", args }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as CatchState;
    state.process.yieldBack(result.value);
    return this.run(state, scope);
  }
  private run(state: CatchState, scope: Scope) {
    for (;;) {
      switch (state.step) {
        case "beforeBody": {
          const body = state.args[1];
          // TODO check type
          state.process = scope.prepareScriptValue(body as ScriptValue); // TODO check type
          state.bodyProcess = state.process;
          state.step = "inBody";
          break;
        }
        case "inBody": {
          state.result = state.process.run();
          state.bodyResult = state.result;
          state.step = "beforeHandler";
          break;
        }
        case "beforeHandler": {
          if (state.result.code == ResultCode.OK) {
            state.step = "beforeFinally";
            break;
          }
          const i = this.findHandlerIndex(state.result.code, state.args);
          if (i < 0) {
            state.step = "beforeFinally";
            break;
          }
          switch (state.result.code) {
            case ResultCode.RETURN:
            case ResultCode.YIELD:
            case ResultCode.ERROR: {
              const varname = state.args[i + 1];
              const handler = state.args[i + 2];
              const subscope = new Scope(scope, true);
              subscope.setLocal(varname.asString(), state.result.value);
              state.process = subscope.prepareScriptValue(
                handler as ScriptValue
              ); // TODO check type
              break;
            }
            case ResultCode.BREAK:
            case ResultCode.CONTINUE: {
              const handler = state.args[i + 1];
              state.process = scope.prepareScriptValue(handler as ScriptValue); // TODO check type
              break;
            }
          }
          state.step = "inHandler";
          break;
        }
        case "inHandler": {
          state.result = state.process.run();
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          if (state.result.code == passData) {
            state.result = state.bodyResult;
            if (state.result.code == ResultCode.YIELD) {
              state.process = state.bodyProcess;
              state.step = "inBody";
              return YIELD(state.result.value, state);
            }
          } else if (state.result.code != ResultCode.OK) return state.result;
          state.step = "beforeFinally";
          break;
        }
        case "beforeFinally": {
          const i = this.findFinallyIndex(state.args);
          if (i < 0) return state.result;
          const handler = state.args[i + 1];
          state.process = scope.prepareScriptValue(handler as ScriptValue); // TODO check type
          state.step = "inFinally";
          break;
        }
        case "inFinally": {
          const result = state.process.run();
          if (result.code == ResultCode.YIELD)
            return YIELD(result.value, state);
          if (result.code != ResultCode.OK) return result;
          return state.result;
        }
      }
    }
  }
  private findHandlerIndex(
    code: ResultCode | CustomResultCode,
    args: Value[]
  ): number {
    let i = 2;
    while (i < args.length) {
      const keyword = args[i].asString();
      switch (keyword) {
        case "return":
          if (code == ResultCode.RETURN) return i;
          i += 3;
          break;
        case "yield":
          if (code == ResultCode.YIELD) return i;
          i += 3;
          break;
        case "error":
          if (code == ResultCode.ERROR) return i;
          i += 3;
          break;
        case "break":
          if (code == ResultCode.BREAK) return i;
          i += 2;
          break;
        case "continue":
          if (code == ResultCode.CONTINUE) return i;
          i += 2;
          break;
        case "finally":
          i += 2;
          break;
      }
    }
    return -1;
  }
  private findFinallyIndex(args: Value[]): number {
    let i = 2;
    while (i < args.length) {
      const keyword = args[i].asString();
      switch (keyword) {
        case "return":
          i += 3;
          break;
        case "yield":
          i += 3;
          break;
        case "error":
          i += 3;
          break;
        case "break":
          i += 2;
          break;
        case "continue":
          i += 2;
          break;
        case "finally":
          return i;
      }
    }
    return -1;
  }
  private checkArgs(args: Value[]): Result {
    let i = 2;
    while (i < args.length) {
      const keyword = args[i].asString();
      switch (keyword) {
        case "return":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong #args: missing return handler value");
            case 2:
              return ERROR("wrong #args: missing return handler body");
            default:
              i += 3;
          }
          break;
        case "yield":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong #args: missing yield handler value");
            case 2:
              return ERROR("wrong #args: missing yield handler body");
            default:
              i += 3;
          }
          break;
        case "error":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong #args: missing error handler message");
            case 2:
              return ERROR("wrong #args: missing error handler body");
            default:
              i += 3;
          }
          break;
        case "break":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong #args: missing break handler body");
            default:
              i += 2;
          }
          break;
        case "continue":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong #args: missing continue handler body");
            default:
              i += 2;
          }
          break;
        case "finally":
          switch (args.length - i) {
            case 1:
              return ERROR("wrong #args: missing finally handler body");
            default:
              i += 2;
          }
          break;
        default:
          return ERROR(`invalid keyword "${keyword}"`);
      }
    }
    if (i == args.length) return OK(NIL);
    return ARITY_ERROR(
      "catch body ?return value handler? ?yield value handler? ?error message handler? ?break handler? ?continue handler? ?finally handler?"
    );
  }
}
const catchCmd = new CatchCommand();

const passData: CustomResultCode = { name: "pass" };
const passCmd: Command = {
  execute(args) {
    if (args.length != 1) return ARITY_ERROR("pass");
    return CUSTOM_RESULT(passData);
  },
};

export function registerControlCommands(scope: Scope) {
  scope.registerCommand("while", whileCmd);
  scope.registerCommand("if", ifCmd);
  scope.registerCommand("when", whenCmd);
  scope.registerCommand("catch", catchCmd);
  scope.registerCommand("pass", passCmd);
}
