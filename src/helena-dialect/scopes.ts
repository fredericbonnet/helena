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
import {
  Value,
  ScriptValue,
  ValueType,
  TUPLE,
  STR,
  StringValue,
  CommandValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Process, Scope } from "./core";
import { Subcommands } from "./subcommands";

const SCOPE_SIGNATURE = "scope ?name? body";
class ScopeCommand implements Command {
  readonly value: Value;
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.value = new CommandValue(this);
    this.scope = scope;
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "eval",
    "call",
  ]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    return ScopeCommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<scope> subcommands");
        return OK(ScopeCommand.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<scope> eval body");
        return DeferredValue.create(ResultCode.YIELD, args[2], this.scope);
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<scope> call cmdname ?arg ...?");
        const { data: command, code } = StringValue.toString(args[2]);
        if (code != ResultCode.OK) return ERROR("invalid command name");
        if (!this.scope.hasLocalCommand(command))
          return ERROR(`unknown command "${command}"`);
        const cmdline = args.slice(2);
        return DeferredValue.create(
          ResultCode.YIELD,
          TUPLE(cmdline),
          this.scope
        );
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
      const command = new ScopeCommand(state.subscope);
      if (state.name) {
        const result = state.scope.registerCommand(state.name, command);
        if (result.code != ResultCode.OK) return result;
      }
      return OK(
        result.code == ResultCode.RETURN ? result.value : command.value
      );
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
