/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, ValueType, NIL, LIST, STR } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { Subcommands } from "./subcommands";

type Exports = Map<string, Value>;

class ExportCommand implements Command {
  readonly exports: Exports;
  constructor(exports: Exports) {
    this.exports = exports;
  }
  execute(args: Value[]): Result {
    if (args.length != 2) return ARITY_ERROR("export name");
    const name = args[1].asString?.();
    if (name == null) return ERROR("invalid export name");
    this.exports.set(name, STR(name));
    return OK(NIL);
  }
}

class ModuleValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly exports: Exports;
  constructor(scope: Scope, exports: Exports) {
    this.command = this;
    this.scope = scope;
    this.exports = exports;
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "exports",
    "import",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this);
    return ModuleValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<module> subcommands");
        return OK(ModuleValue.subcommands.list);
      },
      exports: () => {
        if (args.length != 2) return ARITY_ERROR("<module> exports");
        return OK(LIST([...this.exports.values()]));
      },
      import: () => {
        if (args.length != 3) return ARITY_ERROR("<module> import name");
        const name = args[2].asString?.();
        if (name == null) return ERROR("invalid import name");
        if (!this.exports.has(name)) return ERROR(`unknown export "${name}"`);
        const command = this.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve export "${name}"`);
        scope.registerNamedCommand(name, command);
        return OK(NIL);
      },
    });
  }
}
export const moduleCmd: Command = {
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
        return ARITY_ERROR("module ?name? body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const rootScope = new Scope();
    initCommands(rootScope);
    const exports = new Map();
    rootScope.registerNamedCommand("export", new ExportCommand(exports));

    const process = rootScope.prepareScriptValue(body as ScriptValue);
    const result = process.run();
    switch (result.code) {
      case ResultCode.OK: {
        const value = new ModuleValue(rootScope, exports);
        if (name) {
          const result = scope.registerCommand(name, value);
          if (result.code != ResultCode.OK) return result;
        }
        return OK(value);
      }
      case ResultCode.ERROR:
        return result;
      default:
        return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
    }
  },
};
