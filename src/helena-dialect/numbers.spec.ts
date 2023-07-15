import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
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

  mochadoc.section("Integers", () => {
    mochadoc.description(() => {
      /**
       * Integer number values (or integers) are Helena values whose internal
       * type is `INTEGER`.
       */
    });

    it("are valid commands", () => {
      /**
       * Integers are implicit commands. Any command name that can be parsed as
       * an integer is resolved as such.
       */
      expect(evaluate("1")).to.eql(INT(1));
    });
    it("are idempotent", () => {
      /**
       * Argument-less integer commands return themselves.
       */
      expect(evaluate("[1]")).to.eql(INT(1));
    });
    it("can be expressed as strings", () => {
      expect(evaluate('"123"')).to.eql(INT(123));
    });

    describe("Exceptions", () => {
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

  mochadoc.section("Real numbers", () => {
    mochadoc.description(() => {
      /**
       * Real number values (or reals) are Helena values whose internal type is
       * `NUMBER`.
       */
    });

    it("are valid commands", () => {
      /**
       * Reals are implicit commands. Any command name that can be parsed as a
       * non-integer number is resolved as such.
       */
      expect(evaluate("1.25")).to.eql(NUM(1.25));
    });
    it("are idempotent", () => {
      /**
       * Argument-less real number commands return themselves.
       */
      expect(evaluate("[1.25]")).to.eql(NUM(1.25));
    });
    it("can be expressed as strings", () => {
      expect(evaluate('"0.5"')).to.eql(NUM(0.5));
    });

    describe("Exceptions", () => {
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

  mochadoc.section("Infix operators", () => {
    mochadoc.description(() => {
      /**
       * A number followed by an operator can be used to express an infix
       * expression.
       */
    });
    mochadoc.section("Arithmetic", () => {
      mochadoc.description(() => {
        /**
         * Numbers support the standard arithmetic operators.
         */
      });

      specify("`+`", () => {
        expect(evaluate("1 + 2")).to.eql(INT(3));
        expect(evaluate("1 + 2 + 3 + 4")).to.eql(INT(10));
      });

      specify("`-`", () => {
        expect(evaluate("1 - 2")).to.eql(INT(-1));
        expect(evaluate("1 - 2 - 3 - 4")).to.eql(INT(-8));
      });

      specify("`*`", () => {
        expect(evaluate("1 * 2")).to.eql(INT(2));
        expect(evaluate("1 * 2 * 3 * 4")).to.eql(INT(24));
      });

      specify("`/`", () => {
        expect(evaluate("1 / 2")).to.eql(NUM(0.5));
        expect(evaluate("1 / 2 / 4 / 8")).to.eql(NUM(0.015625));
        expect(evaluate("1 / 0")).to.eql(NUM(Infinity));
        expect(evaluate("-1 / 0")).to.eql(NUM(-Infinity));
        expect(evaluate("0 / 0")).to.eql(NUM(NaN));
      });

      specify("Precedence rules", () => {
        /**
         * Operators are evaluated left-to-right with the following precedence
         * rules (highest to lowest):
         *
         * - `*` `/`
         * - `+` `-`
         *
         * Other operators cannot be mixed with the above and need to be
         * enclosed in their own expressions. To that effect, brace characters
         * are used for grouping.
         */
        expect(evaluate("1 + 2 * 3 * 4 + 5")).to.eql(INT(30));
        expect(evaluate("1 * 2 + 3 * 4 + 5 + 6 * 7")).to.eql(INT(61));
        expect(evaluate("1 - 2 * 3 * 4 + 5")).to.eql(INT(-18));
        expect(evaluate("1 - 2 * 3 / 4 + 5 * 6 / 10")).to.eql(NUM(2.5));
        expect(evaluate("10 / 2 / 5")).to.eql(INT(1));
      });

      specify("Conversions", () => {
        /**
         * Integers and reals can be mixed in the same expressions, the result
         * will be losslessly converted to an integer whenever possible.
         */
        expect(evaluate("1 + 2.3")).to.eql(NUM(3.3));
        expect(evaluate("1.5 + 2.5")).to.eql(INT(4));
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
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

    mochadoc.description(() => {
      /**
       * Numbers support the standard comparison operators.
       */
    });

    mochadoc.section("Comparisons", () => {
      describe("`==`", () => {
        it("should compare two numbers", () => {
          expect(evaluate('"123" == -34')).to.equal(FALSE);
          expect(evaluate('56 == "56.0"')).to.equal(TRUE);
          expect(evaluate("set var 1; $var == $var")).to.equal(TRUE);
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The operator will return an error message with usage when given
             * the wrong number of arguments.
             */
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

      describe("`!=`", () => {
        it("should compare two numbers", () => {
          expect(evaluate('"123" != -34')).to.equal(TRUE);
          expect(evaluate('56 != "56.0"')).to.equal(FALSE);
          expect(evaluate("set var 1; $var != $var")).to.equal(FALSE);
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The operator will return an error message with usage when given
             * the wrong number of arguments.
             */
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

      describe("`>`", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 > -34")).to.equal(TRUE);
          expect(evaluate('56 > "56.0"')).to.equal(FALSE);
          expect(evaluate("set var 1; $var > $var")).to.equal(FALSE);
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The operator will return an error message with usage when given
             * the wrong number of arguments.
             */
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

      describe("`>=`", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 >= -34")).to.equal(TRUE);
          expect(evaluate('56 >= "56.0"')).to.equal(TRUE);
          expect(evaluate("set var 1; $var >= $var")).to.equal(TRUE);
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The operator will return an error message with usage when given
             * the wrong number of arguments.
             */
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

      describe("`<`", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 < -34")).to.equal(FALSE);
          expect(evaluate('56 < "56.0"')).to.equal(FALSE);
          expect(evaluate("set var 1; $var < $var")).to.equal(FALSE);
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The operator will return an error message with usage when given
             * the wrong number of arguments.
             */
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

      describe("`<=`", () => {
        it("should compare two numbers", () => {
          expect(evaluate("12 <= -34")).to.equal(FALSE);
          expect(evaluate('56 <= "56.0"')).to.equal(TRUE);
          expect(evaluate("set var 1; $var <= $var")).to.equal(TRUE);
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The operator will return an error message with usage when given
             * the wrong number of arguments.
             */
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

  mochadoc.section("Subcommands", () => {
    mochadoc.description(() => {
      /**
       * Apart from operators, number commands accept the subcommands listed
       * here.
       */
    });

    mochadoc.section("Introspection", () => {
      describe("`subcommands`", () => {
        it("should return list of subcommands", () => {
          /**
           * This subcommand is useful for introspection and interactive
           * calls.
           */
          expect(evaluate("1 subcommands")).to.eql(
            evaluate("list (subcommands + - * / == != > >= < <=)")
          );
          expect(evaluate("1.2 subcommands")).to.eql(
            evaluate("list (subcommands + - * / == != > >= < <=)")
          );
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            expect(execute("1 subcommands a")).to.eql(
              ERROR('wrong # args: should be "<number> subcommands"')
            );
            expect(execute("1.2 subcommands a")).to.eql(
              ERROR('wrong # args: should be "<number> subcommands"')
            );
          });
        });
      });
    });
  });
});
