/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, ResultCode, YIELD, OK, ERROR } from "../core/command";
import { Program, ExecutionContext } from "../core/compiler";
import { ScriptValue, StringValue, Value } from "../core/values";
import { Argspec, valueToArgspec } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue } from "./core";

class MacroValue extends CommandValue {
  readonly argspec: Argspec;
  readonly body: ScriptValue;
  constructor(argspec: Argspec, body: ScriptValue) {
    super((scope) => new MacroValueCommand(scope, this));
    this.argspec = argspec;
    this.body = body;
  }
}
class MacroValueCommand implements Command {
  readonly scope: Scope;
  readonly value: MacroValue;
  constructor(scope: Scope, value: MacroValue) {
    this.scope = scope;
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("macro method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        if (args.length < 2) return ARITY_ERROR("macro call ?arg ...?");
        const cmdline = [this.value, ...args.slice(2)];
        return new MacroCommand(this.scope, this.value).execute(cmdline);
      }
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
    }
  }
}

class MacroCommand implements Command {
  readonly scope: Scope;
  readonly value: MacroValue;
  readonly program: Program;
  constructor(scope: Scope, value: MacroValue) {
    this.scope = scope;
    this.value = value;
    this.program = this.scope.compile(this.value.body.script);
  }

  execute(_args: Value[]): Result {
    // TODO args
    return this.run(new ExecutionContext());
  }
  resume(result: Result): Result {
    return this.run(result.state as ExecutionContext);
  }
  run(context: ExecutionContext) {
    const result = this.scope.execute(this.program, context);
    if (result.code == ResultCode.YIELD) return YIELD(result.value, context);
    return result;
  }
}
export const macroCmd = (scope: Scope): Command => ({
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
        return ARITY_ERROR("macro ?name? argspec body");
    }

    const argspec = valueToArgspec(scope, specs);
    const value = new MacroValue(argspec, body as ScriptValue);
    if (name) {
      scope.registerCommand(
        name.asString(),
        (scope: Scope) => new MacroCommand(scope, value)
      );
    }
    return OK(value);
  },
});
