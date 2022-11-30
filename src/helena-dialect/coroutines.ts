/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, OK, Result, ResultCode } from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, FALSE, TRUE, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, Process, Scope } from "./core";

class CoroutineValue extends CommandValue {
  readonly scope: Scope;
  readonly body: ScriptValue;
  state: "inactive" | "active" | "done";
  process: Process;
  constructor(command: Command, scope: Scope, body: ScriptValue) {
    super(command);
    this.scope = scope;
    this.body = body;
    this.state = "inactive";
  }
}
class CoroutineCommand implements Command {
  readonly value: CoroutineValue;
  constructor(scope: Scope, body: ScriptValue) {
    this.value = new CoroutineValue(this, scope, body);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("coroutine method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "wait": {
        if (args.length != 2) return ARITY_ERROR("coroutine wait");
        if (this.value.state == "inactive") {
          this.value.state = "active";
          this.value.process = this.value.scope.prepareScriptValue(
            this.value.body
          );
        }
        return this.run();
      }
      case "active": {
        if (args.length != 2) return ARITY_ERROR("coroutine active");
        return OK(this.value.state == "active" ? TRUE : FALSE);
      }
      case "done": {
        if (args.length != 2) return ARITY_ERROR("coroutine done");
        return OK(this.value.state == "done" ? TRUE : FALSE);
      }
      case "yield": {
        if (args.length != 2 && args.length != 3)
          return ARITY_ERROR("coroutine yield ?value?");
        if (this.value.state == "inactive")
          return ERROR("coroutine is inactive");
        if (this.value.state == "done") return ERROR("coroutine is done");
        if (args.length == 3) {
          this.value.process.yieldBack(args[2]);
        }
        return this.run();
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }

  private run() {
    const result = this.value.process.run();
    switch (result.code) {
      case ResultCode.OK:
      case ResultCode.RETURN:
        this.value.state = "done";
        return OK(result.value);
      case ResultCode.YIELD:
        return OK(result.value);
      case ResultCode.BREAK:
        return ERROR("unexpected break");
      case ResultCode.CONTINUE:
        return ERROR("unexpected continue");
      default:
        return result;
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

    const command = new CoroutineCommand(scope, body as ScriptValue);
    return OK(command.value);
  },
};
