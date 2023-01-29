/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  RESULT_CODE_NAME,
  ERROR,
  OK,
  Result,
  ResultCode,
} from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, FALSE, TRUE, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, commandValueType, Process, Scope } from "./core";

class CoroutineValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly body: ScriptValue;
  state: "inactive" | "active" | "done";
  process: Process;
  constructor(scope: Scope, body: ScriptValue) {
    this.command = this;
    this.scope = scope;
    this.body = body;
    this.state = "inactive";
  }

  asString(): string {
    throw new Error("Method not implemented.");
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this);
    const method = args[1];
    switch (method.asString()) {
      case "wait": {
        if (args.length != 2) return ARITY_ERROR("coroutine wait");
        if (this.state == "inactive") {
          this.state = "active";
          this.process = this.scope.prepareScriptValue(this.body);
        }
        return this.run();
      }
      case "active": {
        if (args.length != 2) return ARITY_ERROR("coroutine active");
        return OK(this.state == "active" ? TRUE : FALSE);
      }
      case "done": {
        if (args.length != 2) return ARITY_ERROR("coroutine done");
        return OK(this.state == "done" ? TRUE : FALSE);
      }
      case "yield": {
        if (args.length != 2 && args.length != 3)
          return ARITY_ERROR("coroutine yield ?value?");
        if (this.state == "inactive") return ERROR("coroutine is inactive");
        if (this.state == "done") return ERROR("coroutine is done");
        if (args.length == 3) {
          this.process.yieldBack(args[2]);
        }
        return this.run();
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }

  private run() {
    const result = this.process.run();
    switch (result.code) {
      case ResultCode.OK:
      case ResultCode.RETURN:
        this.state = "done";
        return OK(result.value);
      case ResultCode.YIELD:
        return OK(result.value);
      case ResultCode.ERROR:
        return result;
      default:
        return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
    }
  }
}
export const coroutineCmd: Command = {
  execute: (args, scope: Scope) => {
    let body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      default:
        return ARITY_ERROR("coroutine body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const value = new CoroutineValue(scope, body as ScriptValue);
    return OK(value);
  },
};
