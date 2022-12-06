import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { IntegerValue, NumberValue } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena math operations", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  beforeEach(() => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("prefix operators", () => {
    describe("arithmetic", () => {
      describe("+", () => {
        it("should accept one number", () => {
          expect(evaluate("+ 3")).to.eql(new IntegerValue(3));
          expect(evaluate("+ -1.2e-3")).to.eql(new NumberValue(-1.2e-3));
        });
        it("should add two numbers", () => {
          expect(evaluate("+ 6 23")).to.eql(new IntegerValue(6 + 23));
          expect(evaluate("+ 4.5e-3 -6")).to.eql(new NumberValue(4.5e-3 - 6));
        });
        it("should add several numbers", () => {
          const numbers = [];
          let total = 0;
          for (let i = 0; i < 10; i++) {
            const v = Math.random();
            numbers.push(v);
            total += v;
          }
          expect(evaluate("+ " + numbers.join(" "))).to.eql(
            new NumberValue(total)
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("+")).to.eql(
              ERROR('wrong # args: should be "+ arg ?arg ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("+ a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe("-", () => {
        it("should negate one number", () => {
          expect(evaluate("- 6")).to.eql(new IntegerValue(-6));
          expect(evaluate("- -3.4e-5")).to.eql(new NumberValue(3.4e-5));
        });
        it("should subtract two numbers", () => {
          expect(evaluate("- 4 12")).to.eql(new IntegerValue(4 - 12));
          expect(evaluate("- 12.3e-4 -56")).to.eql(
            new NumberValue(12.3e-4 + 56)
          );
        });
        it("should subtract several numbers", () => {
          const numbers = [];
          let total = 0;
          for (let i = 0; i < 10; i++) {
            const v = Math.random();
            numbers.push(v);
            if (i == 0) total = v;
            else total -= v;
          }
          expect(evaluate("- " + numbers.join(" "))).to.eql(
            new NumberValue(total)
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("-")).to.eql(
              ERROR('wrong # args: should be "- arg ?arg ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("- a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe("*", () => {
        it("should accept one number", () => {
          expect(evaluate("* 12")).to.eql(new IntegerValue(12));
          expect(evaluate("* -67.89")).to.eql(new NumberValue(-67.89));
        });
        it("should multiply two numbers", () => {
          expect(evaluate("* 45 67")).to.eql(new IntegerValue(45 * 67));
          expect(evaluate("* 1.23e-4 -56")).to.eql(
            new NumberValue(1.23e-4 * -56)
          );
        });
        it("should add several numbers", () => {
          const numbers = [];
          let total = 1;
          for (let i = 0; i < 10; i++) {
            const v = Math.random();
            numbers.push(v);
            total *= v;
          }
          expect(evaluate("* " + numbers.join(" "))).to.eql(
            new NumberValue(total)
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("*")).to.eql(
              ERROR('wrong # args: should be "* arg ?arg ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("* a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe("/", () => {
        it("should divide two numbers", () => {
          expect(evaluate("/ 12 -34")).to.eql(new NumberValue(12 / -34));
          expect(evaluate("/ 45.67e8 -123")).to.eql(
            new NumberValue(45.67e8 / -123)
          );
        });
        it("should divide several numbers", () => {
          const numbers = [];
          let total = 0;
          for (let i = 0; i < 10; i++) {
            const v = Math.random() || 0.1;
            numbers.push(v);
            if (i == 0) total = v;
            else total /= v;
          }
          expect(evaluate("/ " + numbers.join(" "))).to.eql(
            new NumberValue(total)
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("/")).to.eql(
              ERROR('wrong # args: should be "/ arg arg ?arg ...?"')
            );
            expect(execute("/ 1")).to.eql(
              ERROR('wrong # args: should be "/ arg arg ?arg ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("/ a 1")).to.eql(ERROR('invalid number "a"'));
            expect(execute("/ 2 b")).to.eql(ERROR('invalid number "b"'));
          });
        });
      });
    });
  });
});
