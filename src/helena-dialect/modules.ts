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
  CommandValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { Subcommands } from "./subcommands";
import { Tokenizer } from "../core/tokenizer";
import { Parser } from "../core/parser";
import { Script } from "../core/syntax";
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
    const [result, name] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return ERROR("invalid export name");
    this.exports.set(name, STR(name));
    return OK(NIL);
  }
  help(args) {
    if (args.length > 2) return ARITY_ERROR(EXPORT_SIGNATURE);
    return OK(STR(EXPORT_SIGNATURE));
  }
}

export class Module implements Command {
  readonly value: Value;
  readonly scope: Scope;
  readonly exports: Exports;
  constructor(scope: Scope, exports: Exports) {
    this.value = new CommandValue(this);
    this.scope = scope;
    this.exports = exports;
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "exports",
    "import",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    return Module.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<module> subcommands");
        return OK(Module.subcommands.list);
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
  const [result, name] = StringValue.toString(importName);
  if (result.code != ResultCode.OK) return ERROR("invalid import name");
  const [result2, alias] = StringValue.toString(aliasName);
  if (result2.code != ResultCode.OK) return ERROR("invalid alias name");
  if (!exports.has(name)) return ERROR(`unknown export "${name}"`);
  const command = source.resolveNamedCommand(name);
  if (!command) return ERROR(`cannot resolve export "${name}"`);
  destination.registerNamedCommand(alias, command);
  return OK(NIL);
}

export class ModuleRegistry {
  private readonly modules: Map<string, Module> = new Map();
  private readonly reservedNames: Set<string> = new Set();

  isReserved(name: string) {
    return this.reservedNames.has(name);
  }
  reserve(name: string) {
    this.reservedNames.add(name);
  }
  release(name: string) {
    this.reservedNames.delete(name);
  }
  isRegistered(name: string) {
    return this.modules.has(name);
  }
  register(name: string, module: Module) {
    this.modules.set(name, module);
  }
  get(name: string): Module {
    return this.modules.get(name);
  }
}

const MODULE_SIGNATURE = "module ?name? body";
class ModuleCommand implements Command {
  readonly moduleRegistry: ModuleRegistry;
  readonly rootDir: string;
  constructor(moduleRegistry: ModuleRegistry, rootDir: string) {
    this.moduleRegistry = moduleRegistry;
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

    const [result, module] = createModule(
      this.moduleRegistry,
      this.rootDir,
      (body as ScriptValue).script
    );
    if (result.code != ResultCode.OK) return result;
    if (name) {
      const result = scope.registerCommand(name, module);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(module.value);
  }
  help(args) {
    if (args.length > 3) return ARITY_ERROR(MODULE_SIGNATURE);
    return OK(STR(MODULE_SIGNATURE));
  }
}

function resolveModule(
  moduleRegistry: ModuleRegistry,
  rootDir: string,
  nameOrPath: string
): [Result, Module?] {
  if (moduleRegistry.isRegistered(nameOrPath)) {
    const module = moduleRegistry.get(nameOrPath);
    return [OK(module.value), module];
  }
  return resolveFileBasedModule(moduleRegistry, rootDir, nameOrPath);
}

function resolveFileBasedModule(
  moduleRegistry: ModuleRegistry,
  rootDir: string,
  filePath: string
): [Result, Module?] {
  const modulePath = path.resolve(rootDir, filePath);
  if (moduleRegistry.isRegistered(modulePath)) {
    const module = moduleRegistry.get(modulePath);
    return [OK(module.value), module];
  }

  const [result, module] = loadFileBasedModule(moduleRegistry, modulePath);
  if (result.code != ResultCode.OK) return [result];
  moduleRegistry.register(modulePath, module);
  return [OK(module.value), module];
}

function loadFileBasedModule(
  moduleRegistry: ModuleRegistry,
  modulePath: string
): [Result, Module?] {
  if (moduleRegistry.isReserved(modulePath)) {
    return [ERROR("circular imports are forbidden")];
  }
  moduleRegistry.reserve(modulePath);

  let data: string;
  try {
    data = fs.readFileSync(modulePath, "utf-8");
  } catch (e) {
    moduleRegistry.release(modulePath);
    return [ERROR("error reading module: " + e.message)];
  }
  const tokens = new Tokenizer().tokenize(data);
  const { success, script, message } = new Parser().parseTokens(tokens);
  if (!success) {
    moduleRegistry.release(modulePath);
    return [ERROR(message)];
  }

  const result = createModule(moduleRegistry, path.dirname(modulePath), script);
  moduleRegistry.release(modulePath);
  return result;
}

function createModule(
  moduleRegistry: ModuleRegistry,
  rootDir: string,
  script: Script
): [Result, Module?] {
  const rootScope = Scope.newRootScope();
  initCommands(rootScope, moduleRegistry, rootDir);

  const exports = new Map();
  rootScope.registerNamedCommand("export", new ExportCommand(exports));

  const program = rootScope.compile(script);
  const process = rootScope.prepareProcess(program);
  const result = process.run();
  if (result.code == ResultCode.ERROR) {
    return [result];
  }
  if (result.code != ResultCode.OK) {
    return [ERROR("unexpected " + RESULT_CODE_NAME(result))];
  }

  const module = new Module(rootScope, exports);
  return [OK(module.value), module];
}

const IMPORT_SIGNATURE = "import path ?name|imports?";
class ImportCommand implements Command {
  readonly moduleRegistry: ModuleRegistry;
  readonly rootDir: string;
  constructor(moduleRegistry: ModuleRegistry, rootDir: string) {
    this.moduleRegistry = moduleRegistry;
    this.rootDir = rootDir;
  }

  execute(args, scope: Scope) {
    if (args.length != 2 && args.length != 3)
      return ARITY_ERROR(IMPORT_SIGNATURE);

    const [result, path] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return ERROR("invalid path");

    const [result2, module] = resolveModule(
      this.moduleRegistry,
      this.rootDir,
      path
    );
    if (result2.code != ResultCode.OK) return result2;

    if (args.length >= 3) {
      switch (args[2].type) {
        case ValueType.LIST:
        case ValueType.TUPLE:
        case ValueType.SCRIPT: {
          // Import names
          const [result, names] = valueToArray(args[2]);
          if (result.code != ResultCode.OK) return result;
          for (const name of names) {
            if (name.type == ValueType.TUPLE) {
              const values = (name as TupleValue).values;
              if (values.length != 2)
                return ERROR("invalid (name alias) tuple");
              const result = importCommand(
                values[0],
                values[1],
                module.exports,
                module.scope,
                scope
              );
              if (result.code != ResultCode.OK) return result;
            } else {
              const result = importCommand(
                name,
                name,
                module.exports,
                module.scope,
                scope
              );
              if (result.code != ResultCode.OK) return result;
            }
          }
          break;
        }
        default: {
          // Module command name
          const result = scope.registerCommand(args[2], module);
          if (result.code != ResultCode.OK) return result;
        }
      }
    }
    return OK(module.value);
  }
  help(args) {
    if (args.length > 3) return ARITY_ERROR(IMPORT_SIGNATURE);
    return OK(STR(IMPORT_SIGNATURE));
  }
}

export function registerModuleCommands(
  scope: Scope,
  moduleRegistry: ModuleRegistry,
  rootDir: string
) {
  scope.registerNamedCommand(
    "module",
    new ModuleCommand(moduleRegistry, rootDir)
  );
  scope.registerNamedCommand(
    "import",
    new ImportCommand(moduleRegistry, rootDir)
  );
}
