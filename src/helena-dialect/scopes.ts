/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, OK, ERROR, ResultCode, YIELD } from "../core/command";
import { Program, ExecutionContext } from "../core/compiler";
import { Value, ScriptValue, StringValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, Scope } from "./core";

class ScopeValue extends CommandValue {
  readonly scope: Scope;
  constructor(scope: Scope) {
    super(() => new ScopeCommand(scope, this));
    this.scope = scope;
  }
}
class ScopeCommand implements Command {
  readonly scope: Scope;
  readonly value: ScopeValue;
  constructor(scope: Scope, value: ScopeValue) {
    this.scope = scope;
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("scope method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("scope eval body");
        const body = args[2] as ScriptValue;
        return this.scope.executeScript(body);
      }
      case "call": {
        if (args.length < 3) return ARITY_ERROR("scope call cmdname ?arg ...?");
        const cmdline = args.slice(2);
        return this.scope.resolveCommand(cmdline[0], false).execute(cmdline);
      }
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
    }
  }
}
type ScopeBodyState = {
  scope: Scope;
  subscope: Scope;
  program: Program;
  context: ExecutionContext;
  name?: Value;
};
export const scopeCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let name, body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      case 3:
        [, name, body] = args;
        break;
      default:
        return ARITY_ERROR("scope ?name? body");
    }

    const subscope = new Scope(scope);
    const program = subscope.compile((body as ScriptValue).script);
    const context = new ExecutionContext();

    return executeScopeBody({ scope, subscope, program, context, name });
  },
  resume(result: Result): Result {
    return executeScopeBody(result.state as ScopeBodyState);
  },
});
const executeScopeBody = (state: ScopeBodyState): Result => {
  const result = state.subscope.execute(state.program, state.context);

  if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
  if (result.code != ResultCode.OK && result.code != ResultCode.RETURN)
    return result;

  const value = new ScopeValue(state.subscope);
  if (state.name) {
    const result2 = state.scope.setNamedCommand(state.name, value);
    if (result2.code != ResultCode.OK) return result2;
  }

  if (result.code == ResultCode.RETURN) return OK(result.value);
  return OK(value);
};