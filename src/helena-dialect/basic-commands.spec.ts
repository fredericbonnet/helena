import { expect } from "chai";
import { ResultCode } from "../core/command";
import { CompilingEvaluator, Evaluator } from "../core/evaluator";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue, TupleValue } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena basic commands", () => {
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

  describe("idem", () => {
    it("should return its argument", () => {
      expect(evaluate("idem val")).to.eql(new StringValue("val"));
      expect(evaluate("idem (a b c)")).to.eql(
        new TupleValue([
          new StringValue("a"),
          new StringValue("b"),
          new StringValue("c"),
        ])
      );
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("idem")).to.throw(
          'wrong # args: should be "idem value"'
        );
        expect(() => evaluate("idem a b")).to.throw(
          'wrong # args: should be "idem value"'
        );
      });
    });
  });

  describe("return", () => {
    specify("result code should be RETURN", () => {
      expect(execute("return").code).to.eql(ResultCode.RETURN);
    });
    it("should return nil by default", () => {
      expect(evaluate("return")).to.eql(NIL);
    });
    it("should return an optional result", () => {
      expect(evaluate("return val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("return a b")).to.throw(
          'wrong # args: should be "return ?result?"'
        );
      });
    });
  });

  describe("yield", () => {
    specify("result code should be YIELD", () => {
      expect(execute("yield").code).to.eql(ResultCode.YIELD);
    });
    it("should yield nil by default", () => {
      expect(evaluate("yield")).to.eql(NIL);
    });
    it("should yield an optional result", () => {
      expect(evaluate("yield val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("yield a b")).to.throw(
          'wrong # args: should be "yield ?result?"'
        );
      });
    });
  });
});
