import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, NUM, TRUE } from "../core/values";
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
      expect(evaluate("1")).to.eql(INT(1));
    });
    it("are idempotent", () => {
      expect(evaluate("[1]")).to.eql(INT(1));
    });
    it("can be expressed as strings", () => {
      expect(evaluate('"123"')).to.eql(INT(123));
    });
    describe("exceptions", () => {
      specify("unknown subcommand", () => {
        expect(execute("1 unknownSubcommand")).to.eql(
          ERROR('unknown subcommand "unknownSubcommand"')
        );
      });
      specify("invalid subcommand name", () => {
        expect(execute("1 []")).to.eql(ERROR("invalid subcommand name"));
      });
    });
  });

  describe("numbers", () => {
    it("are valid commands", () => {
      expect(evaluate("1.25")).to.eql(NUM(1.25));
    });
    it("are idempotent", () => {
      expect(evaluate("[1.25]")).to.eql(NUM(1.25));
    });
    it("can be expressed as strings", () => {
      expect(evaluate('"0.5"')).to.eql(NUM(0.5));
    });
    describe("exceptions", () => {
      specify("unknown subcommand", () => {
        expect(execute("1.23 unknownSubcommand")).to.eql(
          ERROR('unknown subcommand "unknownSubcommand"')
        );
      });
      specify("invalid subcommand name", () => {
        expect(execute("1.23 []")).to.eql(ERROR("invalid subcommand name"));
      });
    });
  });

  describe("infix operators", () => {
    describe("arithmetic", () => {
      specify("+", () => {
        expect(evaluate("1 + 2")).to.eql(INT(3));
        expect(evaluate("1 + 2 + 3 + 4")).to.eql(INT(10));
      });
      specify("-", () => {
        expect(evaluate("1 - 2")).to.eql(INT(-1));
        expect(evaluate("1 - 2 - 3 - 4")).to.eql(INT(-8));
      });
      specify("*", () => {
        expect(evaluate("1 * 2")).to.eql(INT(2));
        expect(evaluate("1 * 2 * 3 * 4")).to.eql(INT(24));
      });
      specify("/", () => {
        expect(evaluate("1 / 2")).to.eql(NUM(0.5));
        expect(evaluate("1 / 2 / 4 / 8")).to.eql(NUM(0.015625));
        expect(evaluate("1 / 0")).to.eql(NUM(Infinity));
        expect(evaluate("-1 / 0")).to.eql(NUM(-Infinity));
        expect(evaluate("0 / 0")).to.eql(NUM(NaN));
      });
      specify("precedence", () => {
        expect(evaluate("1 + 2 * 3 * 4 + 5")).to.eql(INT(30));
        expect(evaluate("1 * 2 + 3 * 4 + 5 + 6 * 7")).to.eql(INT(61));
        expect(evaluate("1 - 2 * 3 * 4 + 5")).to.eql(INT(-18));
        expect(evaluate("1 - 2 * 3 / 4 + 5 * 6 / 10")).to.eql(NUM(2.5));
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
          expect(execute("1 +")).to.eql(
            ERROR(
              'wrong # operands: should be "operand ?operator operand? ?...?"'
            )
          );
        });
        specify("invalid value", () => {
          expect(execute("1 + a")).to.eql(ERROR('invalid number "a"'));
        });
        specify("unknown operator", () => {
          expect(execute("1 + 2 a 3")).to.eql(ERROR('invalid operator "a"'));
        });
        specify("invalid operator", () => {
          expect(execute("1 + 2 [] 3")).to.eql(ERROR("invalid operator"));
        });
      });
    });
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

  describe("subcommands", () => {
    it("should return list of subcommands", () => {
      expect(evaluate("1 subcommands")).to.eql(
        evaluate("list (subcommands + - * / == != > >= < <=)")
      );
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("1 subcommands a")).to.eql(
          ERROR('wrong # args: should be "<number> subcommands"')
        );
      });
    });
  });
});
