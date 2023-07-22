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
import { Value, ScriptValue, ValueType, TUPLE, STR } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import {
  CommandValue,
  commandValueType,
  DeferredValue,
  Process,
  Scope,
} from "./core";
import { Subcommands } from "./subcommands";

const SCOPE_SIGNATURE = "scope ?name? body";
class ScopeValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.command = this;
    this.scope = scope;
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "eval",
    "call",
  ]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this);
    return ScopeValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<scope> subcommands");
        return OK(ScopeValue.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<scope> eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<scope> call cmdname ?arg ...?");
        const command = args[2].asString?.();
        if (command == null) return ERROR("invalid command name");
        if (!this.scope.hasLocalCommand(command))
          return ERROR(`unknown command "${command}"`);
        const cmdline = args.slice(2);
        return YIELD(new DeferredValue(TUPLE(cmdline), this.scope));
      },
    });
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
        return ARITY_ERROR(SCOPE_SIGNATURE);
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
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(SCOPE_SIGNATURE);
    return OK(STR(SCOPE_SIGNATURE));
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
