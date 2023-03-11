/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "fs";
import { exit } from "process";
import * as repl from "repl";
import * as c from "ansi-colors";
import { defaultDisplayFunction, display } from "./src/core/display";
import { Parser, TokenStream } from "./src/core/parser";
import { ResultCode } from "./src/core/results";
import { Tokenizer, TokenType } from "./src/core/tokenizer";
import { initCommands, Scope } from "./src/helena-dialect/helena-dialect";
import {
  isCustomValueType,
  isValue,
  ListValue,
  MapValue,
  ValueType,
} from "./src/core/values";
import { displayListValue } from "./src/helena-dialect/lists";
import { displayMapValue } from "./src/helena-dialect/dicts";

function source(path: string) {
  const data = fs.readFileSync(path, "utf-8");
  const tokens = new Tokenizer().tokenize(data);
  const { success, script, message } = new Parser().parse(tokens);
  if (!success) {
    console.error(message);
    exit(-1);
  }
  const rootScope = new Scope();
  initCommands(rootScope);
  const result = rootScope.executeScript(script);
  switch (result.code) {
    case ResultCode.OK: {
      console.log(result.value.asString());
      break;
    }
    case ResultCode.ERROR: {
      console.error(result.value.asString());
      break;
    }
    default: {
      console.error("unexpected result code", result.code);
    }
  }
}

function prompt() {
  const rootScope = new Scope();
  initCommands(rootScope);
  repl.start({
    eval: (cmd, _context, _filename, callback) => run(rootScope, cmd, callback),
    writer: (output) => printResult(output),
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
  switch (result.code) {
    case ResultCode.OK: {
      return callback(null, result.value);
    }
    case ResultCode.ERROR: {
      return callback(new Error(`error: ${result.value.asString()}`));
    }
    default: {
      return callback(new Error(`unexpected result code ${result.code}`));
    }
  }
}
function printResult(output) {
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
