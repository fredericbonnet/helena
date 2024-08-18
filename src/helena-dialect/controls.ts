/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/commands";
import {
  CUSTOM_RESULT,
  CustomResultCode,
  ERROR,
  OK,
  RESULT_CODE_NAME,
  Result,
  ResultCode,
  YIELD,
  isCustomResult,
} from "../core/results";
import {
  BooleanValue,
  NIL,
  ScriptValue,
  STR,
  StringValue,
  TUPLE,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Process, Scope } from "./core";
import { valueToArray } from "./lists";

const WHILE_SIGNATURE = "while test body";
const whileCmd: Command = {
  execute(args, scope: Scope) {
    let test, body: Value;
    switch (args.length) {
      case 3:
        [, test, body] = args;
        break;
      default:
        return ARITY_ERROR(WHILE_SIGNATURE);
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    let lastResult = OK(NIL);
    let callTest: () => Result;
    if (test.type == ValueType.SCRIPT) {
      const testProgram = scope.compileScriptValue(test as ScriptValue);
      callTest = () => {
        return ContinuationValue.create(scope, testProgram, (result) => {
          if (result.code != ResultCode.OK) return result;
          const [result2, b] = BooleanValue.toBoolean(result.value);
          if (result2.code != ResultCode.OK) return result2;
          if (!b) return lastResult;
          return callBody();
        });
      };
    } else {
      const [result, b] = BooleanValue.toBoolean(test);
      if (result.code != ResultCode.OK) return result;
      if (!b) return lastResult;
      callTest = () => callBody();
    }
    const program = scope.compileScriptValue(body as ScriptValue);
    const callBody = () => {
      return ContinuationValue.create(scope, program, (result) => {
        switch (result.code) {
          case ResultCode.BREAK:
            return lastResult;
          case ResultCode.CONTINUE:
            break;
          case ResultCode.OK:
            lastResult = result;
            break;
          default:
            return result;
        }
        return callTest();
      });
    };
    return callTest();
  },
  help(args) {
    if (args.length > 3) return ARITY_ERROR(WHILE_SIGNATURE);
    return OK(STR(WHILE_SIGNATURE));
  },
};

const IF_SIGNATURE = "if test body ?elseif test body ...? ?else? ?body?";
class IfCommand implements Command {
  execute(args, scope: Scope) {
    const checkResult = this.checkArgs(args);
    if (checkResult.code != ResultCode.OK) return checkResult;
    let i = 0;
    const callTest = () => {
      if (i >= args.length) return OK(NIL);
      const [, keyword] = StringValue.toString(args[i]);
      if (keyword == "else") {
        return callBody();
      }
      const test = args[i + 1];
      if (test.type == ValueType.SCRIPT) {
        const program = scope.compileScriptValue(test as ScriptValue);
        return ContinuationValue.create(scope, program, (result) => {
          if (result.code != ResultCode.OK) return result;
          const [result2, b] = BooleanValue.toBoolean(result.value);
          if (result2.code != ResultCode.OK) return result2;
          if (b) return callBody();
          i += 3;
          return callTest();
        });
      } else {
        const [result, b] = BooleanValue.toBoolean(test);
        if (result.code != ResultCode.OK) return result;
        if (b) return callBody();
        i += 3;
        return callTest();
      }
    };
    const callBody = () => {
      const body =
        StringValue.toString(args[i])[1] == "else" ? args[i + 1] : args[i + 2];
      if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
      const program = scope.compileScriptValue(body as ScriptValue);
      return ContinuationValue.create(scope, program);
    };
    return callTest();
  }
  help() {
    return OK(STR(IF_SIGNATURE));
  }
  private checkArgs(args: Value[]): Result {
    if (args.length == 2) return ERROR("wrong # args: missing if body");
    let i = 3;
    while (i < args.length) {
      const [result, keyword] = StringValue.toString(args[i]);
      if (result.code != ResultCode.OK) return ERROR("invalid keyword");
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
    return ARITY_ERROR(IF_SIGNATURE);
  }
}
const ifCmd = new IfCommand();

const WHEN_SIGNATURE = "when ?command? {?test body ...? ?default?}";
const whenCmd: Command = {
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
        return ARITY_ERROR(WHEN_SIGNATURE);
    }
    const [result, cases] = valueToArray(casesBody);
    if (result.code != ResultCode.OK) return result;
    if (cases.length == 0) return OK(NIL);
    let i = 0;
    const callCommand = (): Result => {
      if (i >= cases.length) return OK(NIL);
      if (i == cases.length - 1) {
        return callBody();
      }
      if (!command) return callTest(NIL);
      if (command.type == ValueType.SCRIPT) {
        const program = scope.compileScriptValue(command as ScriptValue);
        return ContinuationValue.create(scope, program, (result) => {
          if (result.code != ResultCode.OK) return result;
          return callTest(result.value);
        });
      } else {
        return callTest(command);
      }
    };
    const callTest = (command: Value): Result => {
      let test = cases[i];
      if (command != NIL) {
        switch (test.type) {
          case ValueType.TUPLE:
            test = TUPLE([command, ...(test as TupleValue).values]);
            break;
          default:
            test = TUPLE([command, test]);
        }
      }
      let program;
      switch (test.type) {
        case ValueType.SCRIPT: {
          program = scope.compileScriptValue(test as ScriptValue);
          break;
        }
        case ValueType.TUPLE: {
          program = scope.compileTupleValue(test as TupleValue);
          break;
        }
        default: {
          const [result, b] = BooleanValue.toBoolean(test);
          if (result.code != ResultCode.OK) return result;
          if (b) return callBody();
          i += 2;
          return callCommand();
        }
      }
      return ContinuationValue.create(scope, program, (result) => {
        if (result.code != ResultCode.OK) return result;
        const [result2, b] = BooleanValue.toBoolean(result.value);
        if (result2.code != ResultCode.OK) return result2;
        if (b) return callBody();
        i += 2;
        return callCommand();
      });
    };
    const callBody = (): Result => {
      const body = i == cases.length - 1 ? cases[i] : cases[i + 1];
      if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
      const program = scope.compileScriptValue(body as ScriptValue);
      return ContinuationValue.create(scope, program);
    };
    return callCommand();
  },
  help(args) {
    if (args.length > 3) return ARITY_ERROR(WHEN_SIGNATURE);
    return OK(STR(WHEN_SIGNATURE));
  },
};

const CATCH_SIGNATURE =
  "catch body ?return value handler? ?yield value handler? ?error message handler? ?break handler? ?continue handler? ?finally handler?";
type CatchState = {
  args: Value[];
  step:
    | "beforeBody"
    | "inBody"
    | "beforeHandler"
    | "inHandler"
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
      const program = scope.compileScriptValue(body as ScriptValue);
      const result = scope.execute(program);
      const codeName = STR(RESULT_CODE_NAME(result));
      switch (result.code) {
        case ResultCode.OK:
        case ResultCode.RETURN:
        case ResultCode.YIELD:
        case ResultCode.ERROR:
          return OK(TUPLE([codeName, result.value]));
        default:
          return OK(TUPLE([STR(RESULT_CODE_NAME(result))]));
      }
    }
    return this.run({ step: "beforeBody", args }, scope);
  }
  resume(result: Result, scope: Scope): Result {
    const state = result.data as CatchState;
    if (state.step == "inBody") {
      state.bodyProcess.yieldBack(result.value);
    } else {
      state.process.yieldBack(result.value);
    }
    return this.run(state, scope);
  }
  help() {
    return OK(STR(CATCH_SIGNATURE));
  }
  private run(state: CatchState, scope: Scope) {
    for (;;) {
      switch (state.step) {
        case "beforeBody": {
          const body = state.args[1];
          // TODO check type
          const program = scope.compileScriptValue(body as ScriptValue); // TODO check type
          state.bodyProcess = scope.prepareProcess(program);
          state.step = "inBody";
          break;
        }
        case "inBody": {
          state.bodyResult = state.bodyProcess.run();
          state.step = "beforeHandler";
          break;
        }
        case "beforeHandler": {
          if (state.bodyResult.code == ResultCode.OK) {
            state.result = state.bodyResult;
            state.step = "beforeFinally";
            continue;
          }
          const i = this.findHandlerIndex(state.bodyResult.code, state.args);
          if (i >= state.args.length - 1) {
            state.result = state.bodyResult;
            state.step = "beforeFinally";
            continue;
          }
          switch (state.bodyResult.code) {
            case ResultCode.RETURN:
            case ResultCode.YIELD:
            case ResultCode.ERROR: {
              const [, varname] = StringValue.toString(state.args[i + 1]);
              const handler = state.args[i + 2];
              const subscope = scope.newLocalScope();
              subscope.setNamedLocal(varname, state.bodyResult.value);
              const program = subscope.compileScriptValue(
                handler as ScriptValue
              ); // TODO check type
              state.process = subscope.prepareProcess(program);
              break;
            }
            case ResultCode.BREAK:
            case ResultCode.CONTINUE: {
              const handler = state.args[i + 1];
              const program = scope.compileScriptValue(handler as ScriptValue); // TODO check type
              state.process = scope.prepareProcess(program);
              break;
            }
            default:
              throw new Error("CANTHAPPEN");
          }
          state.step = "inHandler";
          break;
        }
        case "inHandler": {
          state.result = state.process.run();
          if (state.result.code == ResultCode.YIELD)
            return YIELD(state.result.value, state);
          if (isCustomResult(state.result, passResultCode)) {
            if (state.bodyResult.code == ResultCode.YIELD) {
              state.step = "inBody";
              return YIELD(state.bodyResult.value, state);
            }
            state.result = state.bodyResult;
            state.step = "beforeFinally";
            continue;
          }
          if (state.result.code != ResultCode.OK) return state.result;
          state.step = "beforeFinally";
          break;
        }
        case "beforeFinally": {
          const i = this.findFinallyIndex(state.args);
          if (i >= state.args.length - 1) return state.result;
          const handler = state.args[i + 1];
          const program = scope.compileScriptValue(handler as ScriptValue); // TODO check type
          state.process = scope.prepareProcess(program);
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
      const [, keyword] = StringValue.toString(args[i]);
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
    return i;
  }
  private findFinallyIndex(args: Value[]): number {
    let i = 2;
    while (i < args.length) {
      const [, keyword] = StringValue.toString(args[i]);
      switch (keyword) {
        case "return":
        case "yield":
        case "error":
          i += 3;
          break;
        case "break":
        case "continue":
          i += 2;
          break;
        case "finally":
          return i;
      }
    }
    return i;
  }
  private checkArgs(args: Value[]): Result {
    let i = 2;
    while (i < args.length) {
      const [result, keyword] = StringValue.toString(args[i]);
      if (result.code != ResultCode.OK) return ERROR("invalid keyword");
      switch (keyword) {
        case "return":
        case "yield":
        case "error":
          switch (args.length - i) {
            case 1:
              return ERROR(`wrong #args: missing ${keyword} handler parameter`);
            case 2:
              return ERROR(`wrong #args: missing ${keyword} handler body`);
            default: {
              if (StringValue.toString(args[i + 1])[0].code != ResultCode.OK)
                return ERROR(`invalid ${keyword} handler parameter name`);
              i += 3;
            }
          }
          break;
        case "break":
        case "continue":
        case "finally":
          switch (args.length - i) {
            case 1:
              return ERROR(`wrong #args: missing ${keyword} handler body`);
            default:
              i += 2;
          }
          break;
        default:
          return ERROR(`invalid keyword "${keyword}"`);
      }
    }
    if (i == args.length) return OK(NIL);
    return ARITY_ERROR(CATCH_SIGNATURE);
  }
}
const catchCmd = new CatchCommand();

const PASS_SIGNATURE = "pass";
const passResultCode: CustomResultCode = { name: "pass" };
const passCmd: Command = {
  execute(args) {
    if (args.length != 1) return ARITY_ERROR(PASS_SIGNATURE);
    return CUSTOM_RESULT(passResultCode);
  },
  help(args) {
    if (args.length != 1) return ARITY_ERROR(PASS_SIGNATURE);
    return OK(STR(PASS_SIGNATURE));
  },
};

export function registerControlCommands(scope: Scope) {
  scope.registerNamedCommand("while", whileCmd);
  scope.registerNamedCommand("if", ifCmd);
  scope.registerNamedCommand("when", whenCmd);
  scope.registerNamedCommand("catch", catchCmd);
  scope.registerNamedCommand("pass", passCmd);
}
