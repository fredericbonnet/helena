/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "fs";
import { exit } from "process";
import * as repl from "repl";
import * as c from "ansi-colors";
import { defaultDisplayFunction, display } from "./src/core/display";
import { ArrayTokenStream } from "./src/core/tokenizer";
import { Parser } from "./src/core/parser";
import {
  ERROR,
  Result,
  ResultCode,
  RESULT_CODE_NAME,
} from "./src/core/results";
import { Tokenizer, TokenType } from "./src/core/tokenizer";
import { initCommands, Scope } from "./src/helena-dialect/helena-dialect";
import {
  isValue,
  ListValue,
  DictionaryValue,
  STR,
  TupleValue,
  Value,
  ValueType,
  StringValue,
  ScriptValue,
  CustomValue,
} from "./src/core/values";
import { displayListValue } from "./src/helena-dialect/lists";
import { displayDictionaryValue } from "./src/helena-dialect/dicts";
import { Command } from "./src/core/command";
import { ARITY_ERROR } from "./src/helena-dialect/arguments";
import {
  PicolScope,
  initPicolCommands,
} from "./src/picol-dialect/picol-dialect";
import { regexpCmd } from "./src/native/javascript-regexp";
import { childProcessCmd } from "./src/native/node-child_process";
import { consoleCmd } from "./src/native/javascript-console";
import { CallbackContext, fsCmd } from "./src/native/node-fs";
import { Module, ModuleRegistry } from "./src/helena-dialect/modules";

const moduleRegistry = new ModuleRegistry();

function sourceFile(path: string, scope: Scope): Result {
  const data = fs.readFileSync(path, "utf-8");
  const tokens = new Tokenizer().tokenize(data);
  const { success, script, message } = new Parser().parse(tokens);
  if (!success) {
    return ERROR(message);
  }
  return scope.executeScript(script);
}

const sourceCmd: Command = {
  execute: function (args: Value[], scope: Scope): Result {
    if (args.length != 2) return ARITY_ERROR("source path");
    const { data: path } = StringValue.toString(args[1]);
    return sourceFile(path, scope);
  },
};
const exitCmd: Command = {
  execute: function (args: Value[]): Result {
    if (args.length != 1) return ARITY_ERROR("exit");
    exit(0);
  },
};
const picolCmd: Command = {
  execute: function (args: Value[]): Result {
    if (args.length != 2) return ARITY_ERROR("picol script");
    if (args[1].type != ValueType.SCRIPT) return ERROR("invalid script");
    const script = (args[1] as ScriptValue).script;
    const scope = new PicolScope();
    initPicolCommands(scope);
    return scope.evaluator.evaluateScript(script);
  },
};

function init() {
  const rootScope = new Scope();
  initCommands(rootScope, moduleRegistry);
  rootScope.registerNamedCommand("source", sourceCmd);
  rootScope.registerNamedCommand("exit", exitCmd);
  rootScope.registerNamedCommand("picol", picolCmd);
  return rootScope;
}

function source(path: string) {
  const rootScope = init();
  const result = sourceFile(path, rootScope);
  processResult(
    result,
    (value) => {
      console.log(resultWriter(value));
      exit(0);
    },
    (error) => {
      console.error(resultWriter(error));
      exit(-1);
    }
  );
}

function registerNativeModule(
  moduleName: string,
  exportName: string,
  command: Command
) {
  const scope = new Scope();
  const exports = new Map();
  scope.registerNamedCommand(exportName, command);
  exports.set(exportName, STR(exportName));
  moduleRegistry.register(moduleName, new Module(scope, exports));
}

function prompt() {
  const rootScope = init();
  registerNativeModule("javascript:RegExp", "RegExp", regexpCmd);
  registerNativeModule("javascript:console", "console", consoleCmd);
  registerNativeModule("node:child_process", "child_process", childProcessCmd);
  registerNativeModule("node:fs", "fs", {
    execute: (args: Value[], scope: Scope): Result => {
      const callbackContext: CallbackContext = {
        callback: (args, scope: Scope) => {
          const process = scope.prepareTupleValue(new TupleValue(args));
          const result = process.run();
          if (result.code == ResultCode.ERROR)
            throw new Error(StringValue.toString(result.value).data);
        },
        context: scope,
      };
      return fsCmd.execute(args, callbackContext);
    },
  });
  repl.start({
    eval: (cmd, _context, _filename, callback) => run(rootScope, cmd, callback),
    writer: (output) => resultWriter(output),
  });
}

function run(scope: Scope, cmd, callback?: (err?: Error, result?) => void) {
  const tokens = new Tokenizer().tokenize(cmd);
  if (
    tokens.length > 0 &&
    tokens[tokens.length - 1].type == TokenType.CONTINUATION
  ) {
    // Continuation, wait for next line
    return callback(new repl.Recoverable(new Error("continuation")));
  }

  const stream = new ArrayTokenStream(tokens);
  const parser = new Parser();
  let parseResult = parser.parseStream(stream);
  if (!parseResult.success) {
    // Parse error
    return callback(new Error(parseResult.message));
  }

  parseResult = parser.closeStream();
  if (!parseResult.success) {
    // Incomplete script, wait for new line
    return callback(new repl.Recoverable(new Error(parseResult.message)));
  }

  const result = scope.executeScript(parseResult.script);
  processResult(
    result,
    (value) => callback(null, value),
    (error) => callback(error)
  );
}

function processResult(result, onSuccess, onError) {
  switch (result.code) {
    case ResultCode.OK: {
      onSuccess(result.value);
      break;
    }
    case ResultCode.ERROR: {
      onError(new Error(StringValue.toString(result.value).data));
      break;
    }
    default: {
      onError(new Error("unexpected " + RESULT_CODE_NAME(result)));
    }
  }
}
function resultWriter(output) {
  if (output instanceof Error) return c.red(output.message);
  const value = display(output, (displayable) => {
    if (displayable instanceof ListValue) return displayListValue(displayable);
    if (displayable instanceof DictionaryValue)
      return displayDictionaryValue(displayable);
    return defaultDisplayFunction(displayable);
  });
  let type;
  if (isValue(output)) {
    if (output.type == ValueType.CUSTOM) {
      type = `CUSTOM[` + (output as CustomValue).customType.name + `]`;
    } else {
      type = ValueType[output.type];
    }
  }
  return c.green(value) + (type ? c.gray(c.italic(" # " + type)) : "");
}

if (process.argv.length > 3) {
  console.error("Usage: helena [script]");
  process.exit();
} else if (process.argv.length == 3) {
  source(process.argv[2]);
} else {
  prompt();
}
