/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  YIELD,
  CustomResultCode,
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

  asString(): string {
    throw new Error("Method not implemented.");
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this);
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("scope eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      }
      case "call": {
        if (args.length < 3) return ARITY_ERROR("scope call cmdname ?arg ...?");
        const cmdline = args.slice(2);
        if (!this.scope.hasLocalCommand(cmdline[0].asString()))
          return ERROR(`invalid command name "${cmdline[0].asString()}"`);
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
        state.scope.registerCommand(state.name.asString(), value);
      }
      return OK(result.code == ResultCode.RETURN ? result.value : value);
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    case ResultCode.BREAK:
      return ERROR("unexpected break");
    case ResultCode.CONTINUE:
      return ERROR("unexpected continue");
    default:
      return ERROR("unexpected " + (result.code as CustomResultCode).name);
  }
};
