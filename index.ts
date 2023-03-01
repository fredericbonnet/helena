/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "fs";
import { exit } from "process";
import * as repl from "repl";
import * as c from "ansi-colors";
import { defaultDisplayFunction, display } from "./src/core/display";
import { Parser, TokenStream } from "./src/core/parser";
import {
  ERROR,
  Result,
  ResultCode,
  RESULT_CODE_NAME,
} from "./src/core/results";
import { Tokenizer, TokenType } from "./src/core/tokenizer";
import { initCommands, Scope } from "./src/helena-dialect/helena-dialect";
import {
  isCustomValueType,
  isValue,
  ListValue,
  MapValue,
  Value,
  ValueType,
} from "./src/core/values";
import { displayListValue } from "./src/helena-dialect/lists";
import { displayMapValue } from "./src/helena-dialect/dicts";
import { Command } from "./src/core/command";
import { ARITY_ERROR } from "./src/helena-dialect/arguments";
import { regexpCmd } from "./src/native/javascript-regexp";
import { childProcessCmd } from "./src/native/node-child_process";

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
    const path = args[1].asString();
    return sourceFile(path, scope);
  },
};

function init() {
  const rootScope = new Scope();
  initCommands(rootScope);
  rootScope.registerNamedCommand("source", sourceCmd);
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

function prompt() {
  const rootScope = init();
  initCommands(rootScope);
  rootScope.registerNamedCommand("javascript:RegExp", regexpCmd);
  rootScope.registerNamedCommand("node:child_process", childProcessCmd);
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

  const stream = new TokenStream(tokens);
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
      onError(new Error(result.value.asString()));
      break;
    }
    default: {
      onError(new Error("unexpected " + RESULT_CODE_NAME(result.code)));
    }
  }
}
function resultWriter(output) {
  if (output instanceof Error) return c.red(output.message);
  const value = display(output, (displayable) => {
    if (displayable instanceof ListValue) return displayListValue(displayable);
    if (displayable instanceof MapValue) return displayMapValue(displayable);
    return defaultDisplayFunction(displayable);
  });
  let type;
  if (isValue(output)) {
    if (isCustomValueType(output.type)) {
      type = output.type["name"];
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
