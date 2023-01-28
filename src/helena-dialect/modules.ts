/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  CustomResultCode,
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
    const name = args[1].asString();
    this.exports.set(name, new StringValue(name));
    return OK(NIL);
  }
}

class ModuleValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly exports: Exports;
  constructor(command: Command, scope: Scope, exports: Exports) {
    this.command = command;
    this.scope = scope;
    this.exports = exports;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
}
class ModuleCommand implements Command {
  readonly value: ModuleValue;
  constructor(scope: Scope, exports: Exports) {
    this.value = new ModuleValue(this, scope, exports);
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    const method = args[1];
    switch (method.asString()) {
      case "exports": {
        if (args.length != 2) return ARITY_ERROR("module exports");
        return OK(new ListValue([...this.value.exports.values()]));
      }
      case "import": {
        if (args.length != 3) return ARITY_ERROR("module import name");
        const name = args[2].asString();
        if (!this.value.exports.has(name))
          return ERROR(`unknown export "${name}"`);
        const command = this.value.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve export "${name}"`);
        scope.registerCommand(name, command);
        return OK(NIL);
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
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
    rootScope.registerCommand("export", new ExportCommand(exports));
    const process = rootScope.prepareScriptValue(body as ScriptValue);
    const result = process.run();
    switch (result.code) {
      case ResultCode.OK: {
        const command = new ModuleCommand(rootScope, exports);
        if (name) {
          scope.registerCommand(name.asString(), command);
        }
        return OK(command.value);
      }
      case ResultCode.ERROR:
        return result;
      case ResultCode.RETURN:
        return ERROR("unexpected return");
      case ResultCode.YIELD:
        return ERROR("unexpected yield");
      case ResultCode.BREAK:
        return ERROR("unexpected break");
      case ResultCode.CONTINUE:
        return ERROR("unexpected continue");
      default:
        return ERROR("unexpected " + (result.code as CustomResultCode).name);
    }
  },
};
