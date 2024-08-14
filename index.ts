/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "fs";
import { exit } from "process";
import * as repl from "repl";
import * as c from "ansi-colors";
import {
  Displayable,
  defaultDisplayFunction,
  display,
  undisplayableValue,
} from "./src/core/display";
import { ArrayTokenStream, StringStream } from "./src/core/tokenizer";
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
  Value,
  ValueType,
  StringValue,
  ScriptValue,
  CustomValue,
  CommandValue,
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
import { ContinuationValue } from "./src/helena-dialect/core";
import { ErrorStack } from "./src/core/errors";

const moduleRegistry = new ModuleRegistry({
  captureErrorStack: true,
  capturePositions: true,
});

function sourceFile(path: string, scope: Scope): Result {
  const data = fs.readFileSync(path, "utf-8");
  const tokens = new Tokenizer().tokenize(data);
  const { success, script, message } = new Parser().parseTokens(tokens);
  if (!success) {
    return ERROR(message);
  }
  const program = scope.compile(script);
  const process = scope.prepareProcess(program);
  return process.run();
}

const sourceCmd: Command = {
  execute: function (args: Value[], scope: Scope): Result {
    if (args.length != 2) return ARITY_ERROR("source path");
    const [, path] = StringValue.toString(args[1]);
    try {
      const data = fs.readFileSync(path, "utf-8");
      const input = new StringStream(data, path);
      const output = new ArrayTokenStream([], input.source);
      new Tokenizer().tokenizeStream(input, output);
      const { success, script, message } = new Parser({
        capturePositions: true,
      }).parse(output);
      if (!success) {
        return ERROR(message);
      }
      const program = scope.compile(script);
      return ContinuationValue.create(scope, program);
    } catch (e) {
      return ERROR(e.message);
    }
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
  const rootScope = Scope.newRootScope({
    captureErrorStack: true,
    capturePositions: true,
  });
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
  const scope = Scope.newRootScope();
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
          const program = scope.compileArgs(...args);
          const process = scope.prepareProcess(program);
          const result = process.run();
          if (result.code == ResultCode.ERROR)
            throw new Error(StringValue.toString(result.value)[1]);
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
  const input = new StringStream(cmd);
  const tokens = [];
  const output = new ArrayTokenStream(tokens, input.source);
  new Tokenizer().tokenizeStream(input, output);
  if (
    tokens.length > 0 &&
    tokens[tokens.length - 1].type == TokenType.CONTINUATION
  ) {
    // Continuation, wait for next line
    return callback(new repl.Recoverable(new Error("continuation")));
  }

  const parser = new Parser({ capturePositions: true });
  let parseResult = parser.parseStream(output);
  if (!parseResult.success) {
    // Parse error
    return callback(new Error(parseResult.message));
  }

  parseResult = parser.closeStream();
  if (!parseResult.success) {
    // Incomplete script, wait for new line
    return callback(new repl.Recoverable(new Error(parseResult.message)));
  }

  const program = scope.compile(parseResult.script);
  const process = scope.prepareProcess(program);
  const result = process.run();
  if (result.code == ResultCode.ERROR) {
    printErrorStack(result.data as ErrorStack);
  }
  processResult(
    result,
    (value) => callback(null, value),
    (error) => callback(error)
  );
}
function printErrorStack(errorStack: ErrorStack) {
  for (let level = 0; level < errorStack.depth(); level++) {
    const l = errorStack.level(level);
    let log = `[${level}] `;
    if (l.source && l.source.filename) {
      log += l.source.filename;
    } else {
      log += "(script)";
    }
    if (l.position) {
      log += `:${l.position.line + 1}:${l.position.column + 1}: `;
    } else {
      log += ` `;
    }
    if (l.frame) {
      log += l.frame.map((arg) => display(arg, displayErrorFrameArg)).join(" ");
    }
    console.debug(c.gray(log));
  }
}
function displayErrorFrameArg(displayable: Displayable): string {
  if (displayable instanceof ListValue) return `[list (...)]`;
  if (displayable instanceof DictionaryValue) return `[dict (...)]`;
  if (displayable instanceof ScriptValue) return `{...}`;
  return displayResult(displayable);
}

function processResult(result, onSuccess, onError) {
  switch (result.code) {
    case ResultCode.OK: {
      onSuccess(result.value);
      break;
    }
    case ResultCode.ERROR: {
      onError(new Error(StringValue.toString(result.value)[1]));
      break;
    }
    default: {
      onError(new Error("unexpected " + RESULT_CODE_NAME(result)));
    }
  }
}
function displayResult(displayable: Displayable): string {
  if (displayable instanceof ListValue)
    return displayListValue(displayable, displayResult);
  if (displayable instanceof DictionaryValue)
    return displayDictionaryValue(displayable, displayResult);
  if (displayable instanceof CommandValue) return undisplayableValue("command");
  return defaultDisplayFunction(displayable);
}
function resultWriter(output) {
  if (output instanceof Error) return c.red(output.message);
  const value = display(output, displayResult);
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
