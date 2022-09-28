import { expect } from "chai";
import { OK, ResultCode } from "../core/command";
import { CompilingEvaluator, Evaluator } from "../core/evaluator";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, StringValue, TRUE } from "../core/values";
import { CommandValue, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena coroutines", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;
  let evaluator: Evaluator;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) => evaluator.executeScript(parse(script));
  const evaluate = (script: string) => {
    const result = execute(script);
    if (result.code == ResultCode.ERROR)
      throw new Error(result.value.asString());
    return result.value;
  };

  beforeEach(() => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
    evaluator = new CompilingEvaluator(
      rootScope.variableResolver,
      rootScope.commandResolver,
      null
    );
  });

  describe("coroutine", () => {
    it("should return a command value", () => {
      expect(evaluate("coroutine {}")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cr [coroutine {}]");
      expect(evaluate("$cr")).to.eql(value);
    });
    describe("body", () => {
      it("should access scope variables", () => {
        evaluate("set var val");
        expect(evaluate("[coroutine {get var}] wait")).to.eql(
          new StringValue("val")
        );
      });
      it("should set scope variables", () => {
        evaluate("set var old");
        evaluate("[coroutine {set var val; set var2 val2}] wait");
        expect(evaluate("get var")).to.eql(new StringValue("val"));
        expect(evaluate("get var2")).to.eql(new StringValue("val2"));
      });
      it("should access scope commands", () => {
        evaluate("macro cmd2 {} {set var val}");
        evaluate("macro cmd {} {cmd2}");
        evaluate("[coroutine {cmd}] wait");
        expect(evaluate("get var")).to.eql(new StringValue("val"));
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt the body with OK code", () => {
          expect(
            execute("[coroutine {set var val1; return; set var val2}] wait")
              .code
          ).to.eql(ResultCode.OK);
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should return passed value", () => {
          expect(execute("[coroutine {return val}] wait")).to.eql(
            OK(new StringValue("val"))
          );
        });
      });
      describe("yield", () => {
        it("should interrupt the body with OK code", () => {
          expect(
            execute("[coroutine {set var val1; return; set var val2}] wait")
              .code
          ).to.eql(ResultCode.OK);
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should return yielded value", () => {
          expect(execute("[coroutine {yield val}] wait")).to.eql(
            OK(new StringValue("val"))
          );
        });
        it("should work recursively", () => {
          evaluate("macro cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("macro cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("macro cmd3 {} {yield val1; idem val2}");
          evaluate("macro cmd4 {} {yield val3; idem val4}");
          evaluate("set cr [coroutine {cmd1}]");
          expect(execute("$cr wait")).to.eql(OK(new StringValue("val1")));
          expect(execute("$cr done")).to.eql(OK(FALSE));
          expect(execute("$cr wait")).to.eql(OK(new StringValue("val2")));
          expect(execute("$cr done")).to.eql(OK(FALSE));
          expect(execute("$cr wait")).to.eql(OK(new StringValue("val3")));
          expect(execute("$cr done")).to.eql(OK(FALSE));
          expect(execute("$cr wait")).to.eql(OK(new StringValue("val4")));
          expect(execute("$cr done")).to.eql(OK(FALSE));
          expect(execute("$cr wait")).to.eql(OK(new StringValue("val5")));
          expect(execute("$cr done")).to.eql(OK(TRUE));
        });
      });
    });
    describe("methods", () => {
      describe("wait", () => {
        it("should evaluate body", () => {
          evaluate("set cr [coroutine {idem val}]");
          expect(evaluate("$cr wait")).to.eql(new StringValue("val"));
        });
        it("should resume yielded body", () => {
          evaluate("set cr [coroutine {yield val1; idem val2}]");
          expect(evaluate("$cr wait")).to.eql(new StringValue("val1"));
          expect(evaluate("$cr wait")).to.eql(new StringValue("val2"));
        });
        it("should return result of completed coroutines", () => {
          evaluate("set cr [coroutine {idem val}]; $cr wait");
          expect(evaluate("$cr wait")).to.eql(new StringValue("val"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[coroutine {}] wait a")).to.throw(
              'wrong # args: should be "coroutine wait'
            );
          });
        });
      });
      describe("active", () => {
        it("should return false on new coroutines", () => {
          evaluate("set cr [coroutine {}]");
          expect(evaluate("$cr active")).to.eql(FALSE);
        });
        it("should return false on completed coroutines", () => {
          evaluate("set cr [coroutine {}]");
          evaluate("$cr wait");
          expect(evaluate("$cr active")).to.eql(FALSE);
        });
        it("should return true on yielded coroutines", () => {
          evaluate("set cr [coroutine {yield}]");
          evaluate("$cr wait");
          expect(evaluate("$cr active")).to.eql(TRUE);
        });
        it("should return false on yielded coroutines ran to completion", () => {
          evaluate("set cr [coroutine {yield}]");
          evaluate("$cr wait");
          evaluate("$cr wait");
          expect(evaluate("$cr active")).to.eql(FALSE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[coroutine {}] active a")).to.throw(
              'wrong # args: should be "coroutine active'
            );
          });
        });
      });
      describe("done", () => {
        it("should return false on new coroutines", () => {
          evaluate("set cr [coroutine {}]");
          expect(evaluate("$cr done")).to.eql(FALSE);
        });
        it("should return true on completed coroutines", () => {
          evaluate("set cr [coroutine {}]");
          evaluate("$cr wait");
          expect(evaluate("$cr done")).to.eql(TRUE);
        });
        it("should return false on yielded coroutines", () => {
          evaluate("set cr [coroutine {yield}]");
          evaluate("$cr wait");
          expect(evaluate("$cr done")).to.eql(FALSE);
        });
        it("should return true on yielded coroutines ran to completion", () => {
          evaluate("set cr [coroutine {yield}]");
          evaluate("$cr wait");
          evaluate("$cr wait");
          expect(evaluate("$cr done")).to.eql(TRUE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[coroutine {}] done a")).to.throw(
              'wrong # args: should be "coroutine done'
            );
          });
        });
      });
      describe("yield", () => {
        it("should resume yielded body", () => {
          evaluate("set cr [coroutine {set var val1; yield; set var val2}]");
          evaluate("$cr wait");
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
          expect(evaluate("$cr yield")).to.eql(new StringValue("val2"));
          expect(evaluate("get var")).to.eql(new StringValue("val2"));
        });
        it("should yield back value to coroutine", () => {
          evaluate("set cr [coroutine {set var [yield]}]");
          evaluate("$cr wait; $cr yield val");
          expect(evaluate("get var")).to.eql(new StringValue("val"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[coroutine {}] yield a b")).to.throw(
              'wrong # args: should be "coroutine yield ?value?'
            );
          });
          specify("inactive coroutine", () => {
            evaluate("set cr [coroutine {}]");
            expect(() => evaluate("[coroutine {}] yield")).to.throw(
              "coroutine is inactive"
            );
          });
          specify("completed coroutine", () => {
            evaluate("set cr [coroutine {}]; $cr wait");
            expect(() => evaluate("$cr yield")).to.throw("coroutine is done");
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(() => evaluate("[coroutine {}] unknownMethod")).to.throw(
            'invalid method name "unknownMethod"'
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("coroutine")).to.throw(
          'wrong # args: should be "coroutine body"'
        );
        expect(() => evaluate("coroutine a b")).to.throw(
          'wrong # args: should be "coroutine body"'
        );
      });
    });
  });
});