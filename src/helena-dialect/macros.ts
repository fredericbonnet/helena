/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, ResultCode, YIELD, OK, ERROR } from "../core/command";
import { Program, ExecutionContext } from "../core/compiler";
import { ScriptValue, StringValue, Value } from "../core/values";
import { ArgSpec, ARITY_ERROR, valueToArgspecs } from "./arguments";
import { Scope, CommandValue } from "./core";

class MacroValue extends CommandValue {
  readonly argspecs: ArgSpec[];
  readonly body: ScriptValue;
  constructor(argspecs: ArgSpec[], body: ScriptValue) {
    super((scope) => new MacroValueCommand(scope, this));
    this.argspecs = argspecs;
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
        const cmdline = [this.value, ...args.slice(1)];
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
    let name, argspecs, body;
    switch (args.length) {
      case 3:
        [, argspecs, body] = args;
        break;
      case 4:
        [, name, argspecs, body] = args;
        break;
      default:
        return ARITY_ERROR("macro ?name? args body");
    }

    const value = new MacroValue(
      valueToArgspecs(argspecs),
      body as ScriptValue
    );
    if (name) {
      scope.registerCommand(
        name.asString(),
        (scope: Scope) => new MacroCommand(scope, value)
      );
    }
    return OK(value);
  },
});
