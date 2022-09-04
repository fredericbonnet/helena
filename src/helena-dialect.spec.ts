import { expect } from "chai";
import { ResultCode } from "./command";
import { CompilingEvaluator, Evaluator, InlineEvaluator } from "./evaluator";
import { Parser } from "./parser";
import { Scope, initCommands, Variable } from "./helena-dialect";
import { Tokenizer } from "./tokenizer";
import { StringValue } from "./values";

describe("Helena dialect", () => {
  for (let klass of [InlineEvaluator, CompilingEvaluator]) {
    describe(klass.name, () => {
      let rootScope: Scope;

      let tokenizer: Tokenizer;
      let parser: Parser;
      let evaluator: Evaluator;

      const parse = (script: string) =>
        parser.parse(tokenizer.tokenize(script));
      const execute = (script: string) =>
        evaluator.executeScript(parse(script));
      const evaluate = (script: string) => {
        const [code, result] = execute(script);
        if (code == ResultCode.ERROR) throw new Error(result.asString());
        return result;
      };

      beforeEach(() => {
        rootScope = new Scope();
        initCommands(rootScope);

        tokenizer = new Tokenizer();
        parser = new Parser();
        evaluator = new klass(
          rootScope.variableResolver,
          rootScope.commandResolver,
          null
        );
      });

      describe("constants and variables", () => {
        describe("let", () => {
          it("should define the value of a new constant", () => {
            evaluate("let cst val");
            expect(rootScope.constants.get("cst")).to.eql(
              new StringValue("val")
            );
          });
          it("should return the constant value", () => {
            expect(evaluate("let cst val")).to.eql(new StringValue("val"));
          });
          describe("exceptions", () => {
            it("existing constant", () => {
              rootScope.constants.set("cst", new StringValue("old"));
              expect(() => evaluate("let cst val")).to.throw(
                'cannot redefine constant "cst"'
              );
            });
            it("existing variable", () => {
              rootScope.variables.set(
                "var",
                new Variable(new StringValue("old"))
              );
              expect(() => evaluate("let var val")).to.throw(
                'cannot define constant "var": variable already exists'
              );
            });
            specify("wrong arity", () => {
              specify("wrong arity", () => {
                expect(() => evaluate("let")).to.throw(
                  'wrong # args: should be "let constName value"'
                );
                expect(() => evaluate("let a")).to.throw(
                  'wrong # args: should be "let constName value"'
                );
                expect(() => evaluate("let a b c")).to.throw(
                  'wrong # args: should be "let constName value"'
                );
              });
            });
          });
        });
        describe("set", () => {
          it("should set the value of a new variable", () => {
            evaluate("set var val");
            expect(rootScope.variables.get("var")).to.eql(
              new Variable(new StringValue("val"))
            );
          });
          it("should overwrite the value of an existing variable", () => {
            rootScope.variables.set(
              "var",
              new Variable(new StringValue("old"))
            );
            evaluate("set var val");
            expect(rootScope.variables.get("var")).to.eql(
              new Variable(new StringValue("val"))
            );
          });
          it("should return the set value", () => {
            expect(evaluate("set var val")).to.eql(new StringValue("val"));
          });
          describe("exceptions", () => {
            it("existing constant", () => {
              rootScope.constants.set("cst", new StringValue("old"));
              expect(() => evaluate("set cst val")).to.throw(
                'cannot redefine constant "cst"'
              );
            });
            specify("wrong arity", () => {
              expect(() => evaluate("set")).to.throw(
                'wrong # args: should be "set varName value"'
              );
              expect(() => evaluate("set a")).to.throw(
                'wrong # args: should be "set varName value"'
              );
              expect(() => evaluate("set a b c")).to.throw(
                'wrong # args: should be "set varName value"'
              );
            });
          });
        });
        describe("get", () => {});
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
              'wrong # args: should be "get varName"'
            );
            expect(() => evaluate("get a b")).to.throw(
              'wrong # args: should be "get varName"'
            );
          });
        });
      });
    });
  }
});
