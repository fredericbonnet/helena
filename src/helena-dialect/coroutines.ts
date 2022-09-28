/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, ERROR, OK, Result, ResultCode, YIELD } from "../core/command";
import { Program, ExecutionContext } from "../core/compiler";
import { Value, ScriptValue, StringValue, FALSE, TRUE } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, Scope } from "./core";

class CoroutineValue extends CommandValue {
  readonly scope: Scope;
  readonly body: ScriptValue;
  state: "inactive" | "active" | "done";
  program: Program;
  context: ExecutionContext;
  constructor(scope: Scope, body: ScriptValue) {
    super(() => new CoroutineCommand(this));
    this.scope = scope;
    this.body = body;
    this.state = "inactive";
  }
}
class CoroutineCommand implements Command {
  readonly value: CoroutineValue;
  constructor(value: CoroutineValue) {
    this.value = value;
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
          this.value.program = this.value.scope.compile(this.value.body.script);
          this.value.context = new ExecutionContext();
        }
        const result = this.value.scope.execute(
          this.value.program,
          this.value.context
        );
        if (result.code == ResultCode.OK || result.code == ResultCode.RETURN) {
          this.value.state = "done";
          return OK(result.value);
        }
        if (result.code == ResultCode.YIELD) {
          return OK(result.value);
        }
        return result;
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
          return ERROR(new StringValue("coroutine is inactive"));
        if (this.value.state == "done")
          return ERROR(new StringValue("coroutine is done"));
        if (args.length == 3) {
          this.value.context.result = YIELD(
            args[2],
            this.value.context.result.state
          );
        }
        const result = this.value.scope.execute(
          this.value.program,
          this.value.context
        );
        if (result.code == ResultCode.OK || result.code == ResultCode.RETURN) {
          this.value.state = "done";
          return OK(result.value);
        }
        if (result.code == ResultCode.YIELD) {
          return OK(result.value);
        }
        return result;
      }
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
    }
  }
}
export const coroutineCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      default:
        return ARITY_ERROR("coroutine body");
    }

    const value = new CoroutineValue(scope, body as ScriptValue);
    return OK(value);
  },
});
