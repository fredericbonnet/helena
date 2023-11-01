/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "node:fs";
import * as path from "node:path";
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
  NIL,
  LIST,
  STR,
  TupleValue,
  StringValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { Subcommands } from "./subcommands";
import { Tokenizer } from "../core/tokenizer";
import { Parser } from "../core/parser";
import { valueToArray } from "./lists";

type Exports = Map<string, Value>;

const EXPORT_SIGNATURE = "export name";
class ExportCommand implements Command {
  readonly exports: Exports;
  constructor(exports: Exports) {
    this.exports = exports;
  }
  execute(args: Value[]): Result {
    if (args.length != 2) return ARITY_ERROR(EXPORT_SIGNATURE);
    const { data: name, code } = StringValue.toString(args[1]);
    if (code != ResultCode.OK) return ERROR("invalid export name");
    this.exports.set(name, STR(name));
    return OK(NIL);
  }
  help(args) {
    if (args.length > 2) return ARITY_ERROR(EXPORT_SIGNATURE);
    return OK(STR(EXPORT_SIGNATURE));
  }
}

export class ModuleValue implements CommandValue, Command {
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
        if (args.length != 3 && args.length != 4)
          return ARITY_ERROR("<module> import name ?alias?");
        return importCommand(
          args[2],
          args.length == 4 ? args[3] : args[2],
          this.exports,
          this.scope,
          scope
        );
      },
    });
  }
}

function importCommand(
  importName: Value,
  aliasName: Value,
  exports: Exports,
  source: Scope,
  destination: Scope
): Result {
  const { data: name, code } = StringValue.toString(importName);
  if (code != ResultCode.OK) return ERROR("invalid import name");
  const { data: alias, code: code2 } = StringValue.toString(aliasName);
  if (code2 != ResultCode.OK) return ERROR("invalid alias name");
  if (!exports.has(name)) return ERROR(`unknown export "${name}"`);
  const command = source.resolveNamedCommand(name);
  if (!command) return ERROR(`cannot resolve export "${name}"`);
  destination.registerNamedCommand(alias, command);
  return OK(NIL);
}

const MODULE_SIGNATURE = "module ?name? body";
class ModuleCommand implements Command {
  readonly rootDir: string;
  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  execute(args, scope: Scope) {
    let name, body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      case 3:
        [, name, body] = args;
        break;
      default:
        return ARITY_ERROR(MODULE_SIGNATURE);
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const rootScope = new Scope();
    initCommands(rootScope, this.rootDir);
    const exports = new Map();
    rootScope.registerNamedCommand("export", new ExportCommand(exports));

    const process = rootScope.prepareScriptValue(body as ScriptValue);
    const result = process.run();
    if (result.code == ResultCode.ERROR) return result;
    if (result.code != ResultCode.OK)
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));

    const value = new ModuleValue(rootScope, exports);
    if (name) {
      const result = scope.registerCommand(name, value);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(value);
  }
  help(args) {
    if (args.length > 3) return ARITY_ERROR(MODULE_SIGNATURE);
    return OK(STR(MODULE_SIGNATURE));
  }
}

class ModuleRegistry {
  private readonly modules: Map<string, ModuleValue> = new Map();

  isReserved(name: string) {
    return this.modules.has(name) && !this.modules.get(name);
  }
  isRegistered(name: string) {
    return !!this.modules.get(name);
  }
  reserve(name) {
    this.modules.set(name, null);
  }
  register(name: string, module: ModuleValue) {
    this.modules.set(name, module);
  }
  get(name: string): ModuleValue {
    return this.modules.get(name);
  }
  release(name) {
    this.modules.delete(name);
  }
}
const moduleRegistry = new ModuleRegistry();

function resolveModule(
  nameOrPath: string,
  rootDir: string
): Result<ModuleValue> {
  const modulePath = path.resolve(rootDir, nameOrPath);
  if (moduleRegistry.isReserved(modulePath)) {
    return ERROR("circular imports are forbidden");
  }
  if (moduleRegistry.isRegistered(modulePath)) {
    const module = moduleRegistry.get(modulePath);
    return OK(module, module);
  }

  let data: string;
  try {
    data = fs.readFileSync(modulePath, "utf-8");
  } catch (e) {
    return ERROR(e.message);
  }
  const tokens = new Tokenizer().tokenize(data);
  const { success, script, message } = new Parser().parse(tokens);
  if (!success) {
    return ERROR(message);
  }

  moduleRegistry.reserve(modulePath);
  const rootScope = new Scope();
  initCommands(rootScope, path.dirname(modulePath));
  const exports = new Map();
  rootScope.registerNamedCommand("export", new ExportCommand(exports));

  const result = rootScope.executeScript(script);
  if (result.code == ResultCode.ERROR) {
    moduleRegistry.release(modulePath);
    return result as Result<ModuleValue>;
  }
  if (result.code != ResultCode.OK) {
    moduleRegistry.release(modulePath);
    return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }

  const module = new ModuleValue(rootScope, exports);
  moduleRegistry.register(modulePath, module);
  return OK(module, module);
}

const IMPORT_SIGNATURE = "import path ?name|imports?";
class ImportCommand implements Command {
  readonly rootDir: string;
  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  execute(args, scope: Scope) {
    if (args.length != 2 && args.length != 3)
      return ARITY_ERROR(IMPORT_SIGNATURE);

    const { data: path, code } = StringValue.toString(args[1]);
    if (code != ResultCode.OK) return ERROR("invalid path");

    const { data: value, ...result } = resolveModule(path, this.rootDir);
    if (result.code != ResultCode.OK) return result;

    if (args.length >= 3) {
      switch (args[2].type) {
        case ValueType.LIST:
        case ValueType.TUPLE:
        case ValueType.SCRIPT: {
          // Import names
          const { data: names, ...result } = valueToArray(args[2]);
          if (result.code != ResultCode.OK) return result;
          for (const name of names) {
            if (name.type == ValueType.TUPLE) {
              const values = (name as TupleValue).values;
              if (values.length != 2)
                return ERROR("invalid (name alias) tuple");
              const result = importCommand(
                values[0],
                values[1],
                value.exports,
                value.scope,
                scope
              );
              if (result.code != ResultCode.OK) return result;
            } else {
              const result = importCommand(
                name,
                name,
                value.exports,
                value.scope,
                scope
              );
              if (result.code != ResultCode.OK) return result;
            }
          }
          break;
        }
        default: {
          // Module command name
          const result = scope.registerCommand(args[2], value);
          if (result.code != ResultCode.OK) return result;
        }
      }
    }
    return OK(value);
  }
  help(args) {
    if (args.length > 3) return ARITY_ERROR(IMPORT_SIGNATURE);
    return OK(STR(IMPORT_SIGNATURE));
  }
}

export function registerModuleCommands(scope: Scope, rootDir: string) {
  scope.registerNamedCommand("module", new ModuleCommand(rootDir));
  scope.registerNamedCommand("import", new ImportCommand(rootDir));
}
