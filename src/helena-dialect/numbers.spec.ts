import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, IntegerValue, NumberValue, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena numbers", () => {
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

  describe("integers", () => {
    it("are valid commands", () => {
      expect(evaluate("1")).to.eql(new IntegerValue(1));
    });
    it("are idempotent", () => {
      expect(evaluate("[1]")).to.eql(new IntegerValue(1));
    });
    it("can be expressed as strings", () => {
      expect(evaluate('"123"')).to.eql(new IntegerValue(123));
    });
    describe("exceptions", () => {
      specify("non-existing method", () => {
        expect(execute("1 unknownMethod")).to.eql(
          ERROR('invalid method name "unknownMethod"')
        );
      });
    });
  });

  describe("numbers", () => {
    it("are valid commands", () => {
      expect(evaluate("1.25")).to.eql(new NumberValue(1.25));
    });
    it("are idempotent", () => {
      expect(evaluate("[1.25]")).to.eql(new NumberValue(1.25));
    });
    it("can be expressed as strings", () => {
      expect(evaluate('"0.5"')).to.eql(new NumberValue(0.5));
    });
    describe("exceptions", () => {
      specify("non-existing method", () => {
        expect(execute("1.23 unknownMethod")).to.eql(
          ERROR('invalid method name "unknownMethod"')
        );
      });
    });
  });

  describe("infix operators", () => {
    describe("comparisons", () => {
      describe("==", () => {
        it("should compare two numbers", () => {
          expect(evaluate('"123" == -34')).to.equal(FALSE);
          expect(evaluate('56 == "56.0"')).to.equal(TRUE);
          expect(evaluate("set var 1; $var == $var")).to.equal(TRUE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("1 ==")).to.eql(
              ERROR('wrong # operands: should be "operand1 == operand2"')
            );
            expect(execute("1 == 2 3")).to.eql(
              ERROR('wrong # operands: should be "operand1 == operand2"')
            );
          });
          specify("invalid value", () => {
            expect(execute("1 == a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe("!=", () => {
        it("should compare two numbers", () => {
          expect(evaluate('"123" != -34')).to.equal(TRUE);
          expect(evaluate('56 != "56.0"')).to.equal(FALSE);
          expect(evaluate("set var 1; $var != $var")).to.equal(FALSE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("1 !=")).to.eql(
              ERROR('wrong # operands: should be "operand1 != operand2"')
            );
            expect(execute("1 != 2 3")).to.eql(
              ERROR('wrong # operands: should be "operand1 != operand2"')
            );
          });
          specify("invalid value", () => {
            expect(execute("1 != a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe(">", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 > -34")).to.equal(TRUE);
          expect(evaluate('56 > "56.0"')).to.equal(FALSE);
          expect(evaluate("set var 1; $var > $var")).to.equal(FALSE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("1 >")).to.eql(
              ERROR('wrong # operands: should be "operand1 > operand2"')
            );
            expect(execute("1 > 2 3")).to.eql(
              ERROR('wrong # operands: should be "operand1 > operand2"')
            );
          });
          specify("invalid value", () => {
            expect(execute("1 > a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe(">=", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 >= -34")).to.equal(TRUE);
          expect(evaluate('56 >= "56.0"')).to.equal(TRUE);
          expect(evaluate("set var 1; $var >= $var")).to.equal(TRUE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("1 >=")).to.eql(
              ERROR('wrong # operands: should be "operand1 >= operand2"')
            );
            expect(execute("1 >= 2 3")).to.eql(
              ERROR('wrong # operands: should be "operand1 >= operand2"')
            );
          });
          specify("invalid value", () => {
            expect(execute("1 >= a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe("<", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 < -34")).to.equal(FALSE);
          expect(evaluate('56 < "56.0"')).to.equal(FALSE);
          expect(evaluate("set var 1; $var < $var")).to.equal(FALSE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("1 <")).to.eql(
              ERROR('wrong # operands: should be "operand1 < operand2"')
            );
            expect(execute("1 < 2 3")).to.eql(
              ERROR('wrong # operands: should be "operand1 < operand2"')
            );
          });
          specify("invalid value", () => {
            expect(execute("1 < a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
      describe("<=", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 <= -34")).to.equal(FALSE);
          expect(evaluate('56 <= "56.0"')).to.equal(TRUE);
          expect(evaluate("set var 1; $var <= $var")).to.equal(TRUE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("1 <=")).to.eql(
              ERROR('wrong # operands: should be "operand1 <= operand2"')
            );
            expect(execute("1 <= 2 3")).to.eql(
              ERROR('wrong # operands: should be "operand1 <= operand2"')
            );
          });
          specify("invalid value", () => {
            expect(execute("1 <= a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });
    });
  });
});