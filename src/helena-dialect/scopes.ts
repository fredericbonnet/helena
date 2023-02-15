/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  YIELD,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, ValueType, TupleValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import {
  CommandValue,
  commandValueType,
  DeferredValue,
  Process,
  Scope,
} from "./core";

class ScopeValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.command = this;
    this.scope = scope;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this);
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("<scope> eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      }
      case "call": {
        if (args.length < 3)
          return ARITY_ERROR("<scope> call cmdname ?arg ...?");
        const command = args[2];
        if (!command.asString) return ERROR("invalid command name");
        if (!this.scope.hasLocalCommand(command.asString()))
          return ERROR(`invalid command name "${command.asString()}"`);
        const cmdline = args.slice(2);
        return YIELD(new DeferredValue(new TupleValue(cmdline), this.scope));
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}
type ScopeBodyState = {
  scope: Scope;
  subscope: Scope;
  process: Process;
  name?: Value;
};
export const scopeCmd: Command = {
  execute: (args, scope: Scope) => {
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
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const subscope = new Scope(scope);
    const process = subscope.prepareScriptValue(body as ScriptValue);
    return executeScopeBody({ scope, subscope, process, name });
  },
  resume(result: Result): Result {
    const state = result.data as ScopeBodyState;
    state.process.yieldBack(result.value);
    return executeScopeBody(state);
  },
};
const executeScopeBody = (state: ScopeBodyState): Result => {
  const result = state.process.run();
  switch (result.code) {
    case ResultCode.OK:
    case ResultCode.RETURN: {
      const value = new ScopeValue(state.subscope);
      if (state.name) {
        const result = state.scope.registerCommand(state.name, value);
        if (result.code != ResultCode.OK) return result;
      }
      return OK(result.code == ResultCode.RETURN ? result.value : value);
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
