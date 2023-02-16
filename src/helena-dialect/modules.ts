/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import {
  Value,
  ScriptValue,
  ValueType,
  ListValue,
  NIL,
  StringValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

type Exports = Map<string, Value>;

class ExportCommand implements Command {
  readonly exports: Exports;
  constructor(exports: Exports) {
    this.exports = exports;
  }
  execute(args: Value[]): Result {
    if (args.length != 2) return ARITY_ERROR("export name");
    if (!args[1].asString) return ERROR("invalid export name");
    const name = args[1].asString();
    this.exports.set(name, new StringValue(name));
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

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this);
    if (!args[1].asString) return ERROR("invalid method name");
    const method = args[1].asString();
    switch (method) {
      case "exports": {
        if (args.length != 2) return ARITY_ERROR("<module> exports");
        return OK(new ListValue([...this.exports.values()]));
      }
      case "import": {
        if (args.length != 3) return ARITY_ERROR("<module> import name");
        if (!args[2].asString) return ERROR("invalid import name");
        const name = args[2].asString();
        if (!this.exports.has(name)) return ERROR(`unknown export "${name}"`);
        const command = this.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve export "${name}"`);
        scope.registerNamedCommand(name, command);
        return OK(NIL);
      }
      default:
        return ERROR(`invalid method name "${method}"`);
    }
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
