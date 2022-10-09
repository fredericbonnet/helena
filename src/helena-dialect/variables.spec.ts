import { expect } from "chai";
import { ResultCode } from "../core/command";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { StringValue } from "../core/values";
import { Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena constants and variables", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) =>
    rootScope.execute(rootScope.compile(parse(script)));
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
  });

  describe("let", () => {
    it("should define the value of a new constant", () => {
      evaluate("let cst val");
      expect(rootScope.context.constants.get("cst")).to.eql(
        new StringValue("val")
      );
    });
    it("should return the constant value", () => {
      expect(evaluate("let cst val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      it("existing constant", () => {
        rootScope.context.constants.set("cst", new StringValue("old"));
        expect(() => evaluate("let cst val")).to.throw(
          'cannot redefine constant "cst"'
        );
      });
      it("existing variable", () => {
        rootScope.context.variables.set(
          "var",
          new Variable(new StringValue("old"))
        );
        expect(() => evaluate("let var val")).to.throw(
          'cannot define constant "var": variable already exists'
        );
      });
      specify("wrong arity", () => {
        expect(() => evaluate("let")).to.throw(
          'wrong # args: should be "let constname value"'
        );
        expect(() => evaluate("let a")).to.throw(
          'wrong # args: should be "let constname value"'
        );
        expect(() => evaluate("let a b c")).to.throw(
          'wrong # args: should be "let constname value"'
        );
      });
    });
  });
  describe("set", () => {
    it("should set the value of a new variable", () => {
      evaluate("set var val");
      expect(rootScope.context.variables.get("var")).to.eql(
        new Variable(new StringValue("val"))
      );
    });
    it("should overwrite the value of an existing variable", () => {
      rootScope.context.variables.set(
        "var",
        new Variable(new StringValue("old"))
      );
      evaluate("set var val");
      expect(rootScope.context.variables.get("var")).to.eql(
        new Variable(new StringValue("val"))
      );
    });
    it("should return the set value", () => {
      expect(evaluate("set var val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      it("existing constant", () => {
        rootScope.context.constants.set("cst", new StringValue("old"));
        expect(() => evaluate("set cst val")).to.throw(
          'cannot redefine constant "cst"'
        );
      });
      specify("wrong arity", () => {
        expect(() => evaluate("set")).to.throw(
          'wrong # args: should be "set varname value"'
        );
        expect(() => evaluate("set a")).to.throw(
          'wrong # args: should be "set varname value"'
        );
        expect(() => evaluate("set a b c")).to.throw(
          'wrong # args: should be "set varname value"'
        );
      });
    });
  });
  describe("get", () => {
    it("should return the value of an existing variable", () => {
      evaluate("let cst val");
      expect(evaluate("get cst")).to.eql(new StringValue("val"));
    });
    it("should return the value of an existing constant", () => {
      evaluate("set var val");
      expect(evaluate("get var")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("non-existing variable", () => {
        expect(() => evaluate("get unknownVariable")).to.throw(
          'can\'t read "unknownVariable": no such variable'
        );
      });
      specify("wrong arity", () => {
        expect(() => evaluate("get")).to.throw(
          'wrong # args: should be "get varname"'
        );
        expect(() => evaluate("get a b")).to.throw(
          'wrong # args: should be "get varname"'
        );
      });
    });
  });
});
