import { expect } from "chai";
import {
  ERROR_STACK,
  OK,
  RESULT_CODE_NAME,
  RETURN,
  Result,
  ResultCode,
  YIELD,
} from "../core/results";
import { Parser } from "../core/parser";
import { Scope, initCommands } from "./helena-dialect";
import { Tokenizer } from "../core/tokenizer";
import { STR, StringValue } from "../core/values";
import {
  ContinuationValue,
  Process,
  ProcessContext,
  ProcessStack,
} from "./core";
import { ErrorStack } from "../core/errors";

const asString = (value) => StringValue.toString(value).data;

describe("Helena core internals", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parseTokens(tokenizer.tokenize(script)).script;
  const prepareScript = (script: string) =>
    rootScope.prepareProcess(rootScope.compile(parse(script)));

  beforeEach(() => {
    rootScope = Scope.newRootScope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("ContinuationValue", () => {
    specify("simple", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem val"))
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(OK(STR("val")));
    });
    specify("callback", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem val")),
            (result) => RETURN(result.value)
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(RETURN(STR("val")));
    });
    specify("recursive", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("cmd2")),
            (result) =>
              OK(STR(RESULT_CODE_NAME(result) + ":" + asString(result.value)))
          );
        },
      });
      rootScope.registerNamedCommand("cmd2", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem val")),
            (result) => RETURN(result.value)
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #2
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("return:val")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("return:val")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(OK(STR("return:val")));
    });
    specify("sequence", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("cmd2")),
            (result) =>
              OK(STR(RESULT_CODE_NAME(result) + ":" + asString(result.value)))
          );
        },
      });
      rootScope.registerNamedCommand("cmd2", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem val")),
            (result) => RETURN(result.value)
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("idem [cmd]/[cmd]"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #2
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("return:val")));
      /***/
      expect(result).to.eql(OK(STR("return:val")));

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #3
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #4
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #4
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Resume continuation #3
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Close continuation #3
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("return:val")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("return:val/return:val")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(OK(STR("return:val/return:val")));
    });
    specify("subsequence", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem [cmd2]/[cmd2]")),
            (result) =>
              OK(STR(RESULT_CODE_NAME(result) + ":" + asString(result.value)))
          );
        },
      });
      rootScope.registerNamedCommand("cmd2", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem val")),
            (result) => OK(STR("_" + asString(result.value) + "_"))
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #2
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(OK(STR("_val_")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #3
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #3
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(OK(STR("_val_")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("_val_/_val_")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("ok:_val_/_val_")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("ok:_val_/_val_")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(OK(STR("ok:_val_/_val_")));
    });
    specify("interruption", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem [cmd2]/[cmd2]")),
            (result) =>
              OK(STR(RESULT_CODE_NAME(result) + ":" + asString(result.value)))
          );
        },
      });
      rootScope.registerNamedCommand("cmd2", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem val")),
            (result) => RETURN(result.value)
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #2
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("val")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("return:val")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("return:val")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(OK(STR("return:val")));
    });
    specify("iteration", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem 1")),
            (result) => {
              return ContinuationValue.create(
                rootScope,
                rootScope.compile(
                  parse("idem " + asString(result.value) + "2")
                ),
                (result) => {
                  return ContinuationValue.create(
                    rootScope,
                    rootScope.compile(
                      parse("idem " + asString(result.value) + "3")
                    )
                  );
                }
              );
            }
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("1")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #2
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("12")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #3
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("123")));
      /***/

      // Close continuation #3
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("123")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("123")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(OK(STR("123")));
    });
    specify("yield", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem [cmd2]/[cmd2]")),
            (result) =>
              OK(STR(RESULT_CODE_NAME(result) + ":" + asString(result.value)))
          );
        },
      });
      rootScope.registerNamedCommand("cmd2", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem _[yield val]_"))
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #2
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(YIELD(STR("val")));
      /***/

      // Yield back continuation #2
      expect(stack.depth()).to.equal(3);
      context = stack.currentContext();
      /***/
      context.state.result = OK(STR("1"));
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("_1_")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(OK(STR("_1_")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #3
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(3);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(YIELD(STR("val")));
      /***/

      // Yield back continuation #3
      expect(stack.depth()).to.equal(3);
      context = stack.currentContext();
      /***/
      context.state.result = OK(STR("2"));
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(OK(STR("_2_")));
      /***/

      // Close continuation #3
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(2);
      /***/
      expect(result).to.eql(OK(STR("_2_")));
      /***/

      // Resume continuation #1
      expect(stack.depth()).to.equal(2);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("_1_/_2_")));
      /***/

      // Close continuation #1
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(OK(STR("ok:_1_/_2_")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(OK(STR("ok:_1_/_2_")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(YIELD(STR("val")));
      process.yieldBack(STR("1"));
      result = process.run();
      expect(result).to.eql(YIELD(STR("val")));
      process.yieldBack(STR("2"));
      result = process.run();
      expect(result).to.eql(OK(STR("ok:_1_/_2_")));
    });

    specify("replacement", () => {
      rootScope.registerNamedCommand("cmd", {
        execute: () => {
          return ContinuationValue.create(
            rootScope,
            rootScope.compile(parse("idem [cmd2]/[cmd2]"))
          );
        },
      });
      rootScope.registerNamedCommand("cmd2", {
        execute: () => {
          return RETURN(
            new ContinuationValue(
              rootScope,
              rootScope.compile(parse("return val"))
            )
          );
        },
      });

      const stack = new ProcessStack();
      let context: ProcessContext;
      let result: Result;

      // Main program
      const mainProgram = rootScope.compile(parse("cmd"));
      /***/
      context = stack.pushProgram(rootScope, mainProgram);
      expect(stack.depth()).to.equal(1);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Open continuation #1
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result.code).to.eql(ResultCode.RETURN);
      expect(result.value).to.be.instanceOf(ContinuationValue);
      /***/

      // Replace continuation #1 with continuation #2
      stack.pop();
      context = stack.pushContinuation(result.value as ContinuationValue);
      expect(stack.depth()).to.equal(2);
      /***/
      result = context.scope.execute(context.program, context.state);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Close continuation #2
      if (context.callback) result = context.callback(result);
      stack.pop();
      expect(stack.depth()).to.equal(1);
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      // Resume main program
      expect(stack.depth()).to.equal(1);
      context = stack.currentContext();
      /***/
      if (result.code == ResultCode.OK) {
        context.state.result = result;
        result = context.scope.execute(context.program, context.state);
      }
      /***/
      expect(result).to.eql(RETURN(STR("val")));
      /***/

      const process = new Process(rootScope, mainProgram);
      result = process.run();
      expect(result).to.eql(RETURN(STR("val")));
    });
  });

  describe("Process", () => {
    specify("captureErrorStack", () => {
      const source = `
macro cmd1 {} {cmd2}
macro cmd2 {} {error msg}
cmd1
`;
      const program = rootScope.compile(parse(source));
      const process = new Process(rootScope, program, {
        captureErrorStack: true,
      });
      const result = process.run();
      expect(result.code).to.eql(ResultCode.ERROR);
      expect(result.value).to.eql(STR("msg"));
      const errorStack = result.data as ErrorStack;
      expect(errorStack.depth()).to.eql(3);
      expect(errorStack.level(0)).to.eql({
        frame: [STR("error"), STR("msg")],
      });
      expect(errorStack.level(1)).to.eql({ frame: [STR("cmd2")] });
      expect(errorStack.level(2)).to.eql({ frame: [STR("cmd1")] });
    });
  });

  describe("Scope", () => {
    specify("captureErrorStack", () => {
      rootScope = Scope.newRootScope({
        captureErrorStack: true,
      });
      initCommands(rootScope);

      const source = `
macro cmd1 {} {cmd2}
macro cmd2 {} {error msg}
cmd1
`;
      const process = prepareScript(source);
      const result = process.run();
      expect(result.code).to.eql(ResultCode.ERROR);
      expect(result.value).to.eql(STR("msg"));
      const errorStack = result.data as ErrorStack;
      expect(errorStack.depth()).to.eql(3);
      expect(errorStack.level(0)).to.eql({
        frame: [STR("error"), STR("msg")],
      });
      expect(errorStack.level(1)).to.eql({
        frame: [STR("cmd2")],
      });
      expect(errorStack.level(2)).to.eql({
        frame: [STR("cmd1")],
      });
    });
    specify("captureErrorStack + capturePositions", () => {
      parser = new Parser({ capturePositions: true });
      rootScope = Scope.newRootScope({
        capturePositions: true,
        captureErrorStack: true,
      });
      initCommands(rootScope);

      const source = `
macro cmd1 {} {cmd2}
macro cmd2 {} {error msg}
cmd1
`;
      const process = prepareScript(source);
      const result = process.run();
      expect(result.code).to.eql(ResultCode.ERROR);
      expect(result.value).to.eql(STR("msg"));
      const errorStack = result.data as ErrorStack;
      expect(errorStack.depth()).to.eql(3);
      expect(errorStack.level(0)).to.eql({
        frame: [STR("error"), STR("msg")],
        position: { index: 37, line: 2, column: 15 },
      });
      expect(errorStack.level(1)).to.eql({
        frame: [STR("cmd2")],
        position: { index: 16, line: 1, column: 15 },
      });
      expect(errorStack.level(2)).to.eql({
        frame: [STR("cmd1")],
        position: { index: 48, line: 3, column: 0 },
      });
    });
    describe("result error stack", () => {
      const cmd = {
        execute: () => {
          const errorStack = new ErrorStack();
          errorStack.push({ frame: [STR("foo")] });
          return ERROR_STACK("msg", errorStack);
        },
      };

      specify("default options", () => {
        parser = new Parser();
        rootScope = Scope.newRootScope();
        initCommands(rootScope);
        rootScope.registerNamedCommand("cmd", cmd);
        const source = `
macro mac {} {cmd}
mac
`;
        const process = prepareScript(source);
        const result = process.run();
        expect(result.code).to.eql(ResultCode.ERROR);
        expect(result.value).to.eql(STR("msg"));
        expect(result.data).to.be.undefined;
      });
      specify("captureErrorStacks", () => {
        parser = new Parser();
        rootScope = Scope.newRootScope({
          captureErrorStack: true,
        });
        initCommands(rootScope);
        rootScope.registerNamedCommand("cmd", cmd);
        const source = `
macro mac {} {cmd}
mac
`;
        const process = prepareScript(source);
        const result = process.run();
        expect(result.code).to.eql(ResultCode.ERROR);
        expect(result.value).to.eql(STR("msg"));
        const errorStack = result.data as ErrorStack;
        expect(errorStack.depth()).to.eql(3);
        expect(errorStack.level(0)).to.eql({
          frame: [STR("foo")],
        });
        expect(errorStack.level(1)).to.eql({
          frame: [STR("cmd")],
        });
        expect(errorStack.level(2)).to.eql({
          frame: [STR("mac")],
        });
      });
      specify("captureErrorStacks + capturePositions", () => {
        parser = new Parser({ capturePositions: true });
        rootScope = Scope.newRootScope({
          capturePositions: true,
          captureErrorStack: true,
        });
        initCommands(rootScope);
        rootScope.registerNamedCommand("cmd", cmd);
        const source = `
macro mac {} {cmd}
mac
`;
        const process = prepareScript(source);
        const result = process.run();
        expect(result.code).to.eql(ResultCode.ERROR);
        expect(result.value).to.eql(STR("msg"));
        const errorStack = result.data as ErrorStack;
        expect(errorStack.depth()).to.eql(3);
        expect(errorStack.level(0)).to.eql({
          frame: [STR("foo")],
        });
        expect(errorStack.level(1)).to.eql({
          frame: [STR("cmd")],
          position: { index: 15, line: 1, column: 14 },
        });
        expect(errorStack.level(2)).to.eql({
          frame: [STR("mac")],
          position: { index: 20, line: 2, column: 0 },
        });
      });
    });
  });
});
