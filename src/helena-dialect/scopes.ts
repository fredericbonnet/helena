/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/commands";
import {
  Value,
  ScriptValue,
  ValueType,
  STR,
  StringValue,
  CommandValue,
  TupleValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Scope } from "./core";
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
        const body = args[2];
        let program;
        switch (body.type) {
          case ValueType.SCRIPT:
            program = this.scope.compileScriptValue(body as ScriptValue);
            break;
          case ValueType.TUPLE:
            program = this.scope.compileTupleValue(body as TupleValue);
            break;
          default:
            return ERROR("body must be a script or tuple");
        }
        return ContinuationValue.create(this.scope, program);
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<scope> call cmdname ?arg ...?");
        const [result, command] = StringValue.toString(args[2]);
        if (result.code != ResultCode.OK) return ERROR("invalid command name");
        if (!this.scope.hasLocalCommand(command))
          return ERROR(`unknown command "${command}"`);
        const program = this.scope.compileArgs(...args.slice(2));
        return ContinuationValue.create(this.scope, program);
      },
    });
  }
}

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

    const subscope = scope.newChildScope();
    const program = subscope.compileScriptValue(body as ScriptValue);
    return ContinuationValue.create(subscope, program, (result) => {
      switch (result.code) {
        case ResultCode.OK:
        case ResultCode.RETURN: {
          const command = new ScopeCommand(subscope);
          if (name) {
            const result = scope.registerCommand(name, command);
            if (result.code != ResultCode.OK) return result;
          }
          return OK(
            result.code == ResultCode.RETURN ? result.value : command.value
          );
        }
        case ResultCode.ERROR:
          return result;
        default:
          return ERROR("unexpected " + RESULT_CODE_NAME(result));
      }
    });
  },
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(SCOPE_SIGNATURE);
    return OK(STR(SCOPE_SIGNATURE));
  },
};
