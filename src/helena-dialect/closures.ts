/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, ResultCode, YIELD, OK, ERROR } from "../core/command";
import { Program, ExecutionContext } from "../core/compiler";
import { ScriptValue, StringValue, Value } from "../core/values";
import { Argspec, valueToArgspec } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue } from "./core";

class ClosureValue extends CommandValue {
  readonly scope: Scope;
  readonly argspec: Argspec;
  readonly body: ScriptValue;
  readonly program: Program;
  constructor(scope: Scope, argspec: Argspec, body: ScriptValue) {
    super(() => new ClosureValueCommand(this));
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.program = this.scope.compile(this.body.script);
  }
}
class ClosureValueCommand implements Command {
  readonly value: ClosureValue;
  constructor(value: ClosureValue) {
    this.value = value;
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("closure method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        if (args.length < 2) return ARITY_ERROR("closure call ?arg ...?");
        const cmdline = [this.value, ...args.slice(2)];
        return new ClosureCommand(this.value).execute(cmdline);
      }
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
    }
  }
}
class ClosureCommand implements Command {
  readonly value: ClosureValue;
  constructor(value: ClosureValue) {
    this.value = value;
  }

  execute(_args: Value[]): Result {
    // TODO args
    return this.run(new ExecutionContext());
  }
  resume(result: Result): Result {
    return this.run(result.state as ExecutionContext);
  }
  run(context: ExecutionContext) {
    const result = this.value.scope.execute(this.value.program, context);
    if (result.code == ResultCode.YIELD) return YIELD(result.value, context);
    return result;
  }
}
export const closureCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let name, specs, body;
    switch (args.length) {
      case 3:
        [, specs, body] = args;
        break;
      case 4:
        [, name, specs, body] = args;
        break;
      default:
        return ARITY_ERROR("closure ?name? argspec body");
    }

    const argspec = valueToArgspec(scope, specs);
    const value = new ClosureValue(scope, argspec, body as ScriptValue);
    if (name) {
      scope.registerCommand(name.asString(), () => new ClosureCommand(value));
    }
    return OK(value);
  },
});
