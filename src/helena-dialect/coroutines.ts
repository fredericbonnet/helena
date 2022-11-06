/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, OK, Result, ResultCode, YIELD } from "../core/results";
import { Command } from "../core/command";
import { Program, Process } from "../core/compiler";
import { Value, ScriptValue, FALSE, TRUE, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, Scope } from "./core";

class CoroutineValue extends CommandValue {
  readonly scope: Scope;
  readonly body: ScriptValue;
  state: "inactive" | "active" | "done";
  program: Program;
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
          this.value.program = this.value.scope.compile(this.value.body.script);
          this.value.process = new Process();
        }
        const result = this.value.scope.execute(
          this.value.program,
          this.value.process
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
          return ERROR("coroutine is inactive");
        if (this.value.state == "done") return ERROR("coroutine is done");
        if (args.length == 3) {
          this.value.process.result = YIELD(
            args[2],
            this.value.process.result.data
          );
        }
        const result = this.value.scope.execute(
          this.value.program,
          this.value.process
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
        return ERROR(`invalid method name "${method.asString()}"`);
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
