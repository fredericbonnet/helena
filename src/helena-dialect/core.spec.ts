import { expect } from "chai";
import {
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

const asString = (value) => StringValue.toString(value).data;

describe("Helena core internals", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;

  beforeEach(() => {
    rootScope = new Scope();
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

  // TODO example scripts
});
