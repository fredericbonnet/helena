/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, ResultCode, YIELD, OK } from "../core/command";
import { Program, ExecutionContext } from "../core/compiler";
import { ScriptValue, Value } from "../core/values";
import { ArgSpec, ARITY_ERROR, valueToArgspecs } from "./arguments";
import { Scope, CommandValue } from "./core";

class MacroCommand implements Command {
  readonly scope: Scope;
  readonly argspecs: ArgSpec[];
  readonly body: ScriptValue;
  readonly program: Program;
  constructor(scope: Scope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
    this.program = this.scope.compile(this.body.script);
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

    const command = (scope: Scope) =>
      new MacroCommand(scope, valueToArgspecs(argspecs), body as ScriptValue);
    const value = new CommandValue(command);
    if (name) return scope.setNamedCommand(name, value);
    return OK(value);
  },
});
