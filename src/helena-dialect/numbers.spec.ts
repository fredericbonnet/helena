import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, REAL, STR, TRUE } from "../core/values";
import { Scope, commandValueType } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, specifyExample } from "./test-helpers";
import { EnsembleValue } from "./ensembles";

describe("Helena numbers", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  const init = () => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  };
  const usage = (script: string) => {
    init();
    return codeBlock(evaluate("help " + script).asString());
  };
  const example = specifyExample(({ script }) => execute(script));

  beforeEach(init);

  mochadoc.section("Number commands", () => {
    mochadoc.section("Integer numbers", () => {
      mochadoc.description(() => {
        /**
         * Integer number values (or integers) are Helena values whose internal
         * type is `INTEGER`.
         */
      });

      it("are valid commands", () => {
        /**
         * Integers are implicit commands. Any command name that can be parsed
         * as an integer is resolved as such.
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
         * Real number values (or reals) are Helena values whose internal type
         * is `REAL`.
         */
      });

      it("are valid commands", () => {
        /**
         * Reals are implicit commands. Any command name that can be parsed as a
         * non-integer number is resolved as such.
         */
        expect(evaluate("1.25")).to.eql(REAL(1.25));
      });
      it("are idempotent", () => {
        /**
         * Argument-less real number commands return themselves.
         */
        expect(evaluate("[1.25]")).to.eql(REAL(1.25));
      });
      it("can be expressed as strings", () => {
        expect(evaluate('"0.5"')).to.eql(REAL(0.5));
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
          expect(evaluate("1 / 2")).to.eql(REAL(0.5));
          expect(evaluate("1 / 2 / 4 / 8")).to.eql(REAL(0.015625));
          expect(evaluate("1 / 0")).to.eql(REAL(Infinity));
          expect(evaluate("-1 / 0")).to.eql(REAL(-Infinity));
          expect(evaluate("0 / 0")).to.eql(REAL(NaN));
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
          expect(evaluate("1 - 2 * 3 / 4 + 5 * 6 / 10")).to.eql(REAL(2.5));
          expect(evaluate("10 / 2 / 5")).to.eql(INT(1));
        });

        specify("Conversions", () => {
          /**
           * Integers and reals can be mixed in the same expressions, the result
           * will be losslessly converted to an integer whenever possible.
           */
          expect(evaluate("1 + 2.3")).to.eql(REAL(3.3));
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

      mochadoc.section("Comparisons", () => {
        mochadoc.description(() => {
          /**
           * Numbers support the standard comparison operators.
           */
        });

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

  mochadoc.section("`int`", () => {
    mochadoc.summary("Integer number handling");
    mochadoc.usage(usage("int"));
    mochadoc.description(() => {
      /**
       * The `int` command is a type command dedicated to integer values.
       *
       * Integer values are Helena values whose internal type is `INTEGER`. The
       * name `int` was preferred over `integer` because it is shorter and is
       * already used in many other languages like Python and C.
       */
    });

    mochadoc.section("Integer conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `int` will
         * ensure an integer value in return. This property means that `int` can
         * be used for creation and conversion, but also as a type guard in
         * argspecs.
         */
      });

      it("should return integer value", () => {
        expect(evaluate("int 0")).to.eql(INT(0));
      });

      describe("Exceptions", () => {
        specify("values with no string representation", () => {
          expect(execute("int []")).to.eql(
            ERROR("value has no string representation")
          );
          expect(execute("int ()")).to.eql(
            ERROR("value has no string representation")
          );
        });
        specify("invalid values", () => {
          expect(execute("int a")).to.eql(ERROR('invalid integer "a"'));
        });
        specify("real values", () => {
          /**
           * Non-integer real values are not accepted.
           */
          expect(execute("int 1.1")).to.eql(ERROR('invalid integer "1.1"'));
        });
      });

      mochadoc.section("Subcommands", () => {
        mochadoc.description(() => {
          /**
           * The `int` ensemble comes with a number of predefined subcommands
           * listed here.
           */
        });

        mochadoc.section("Introspection", () => {
          describe("`subcommands`", () => {
            it("should return list of subcommands", () => {
              /**
               * This subcommand is useful for introspection and interactive
               * calls.
               */
              expect(evaluate('int "" subcommands')).to.eql(
                evaluate("list (subcommands)")
              );
            });

            describe("Exceptions", () => {
              specify("wrong arity", () => {
                /**
                 * The subcommand will return an error message with usage when
                 * given the wrong number of arguments.
                 */
                expect(execute('int "" subcommands a')).to.eql(
                  ERROR('wrong # args: should be "int value subcommands"')
                );
              });
            });
          });
        });

        mochadoc.section("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute('int "" unknownSubcommand')).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute('int "" []')).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `int` is an ensemble command, which means that it is a collection
         * of subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[int]`.
         */
        expect(evaluate("int").type).to.eql(commandValueType);
        expect(evaluate("int")).to.be.instanceOf(EnsembleValue);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `int` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [int] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("int example foo")).to.eql(STR("bar"));
      });

      mochadoc.section("Examples", () => {
        example("Adding a `positive` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `positive` macro within the `int` ensemble
               * scope, returning whether the value is strictly positive:
               */
            },
            script: `
              [int] eval {
                macro positive {value} {
                  $value > 0
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `positive` just like the predefined `int`
               * subcommands:
               */
            },
            script: "int 1 positive",
            result: TRUE,
          },
          {
            script: "int 0 positive",
            result: FALSE,
          },
          {
            script: "int -1 positive",
            result: FALSE,
          },
        ]);
      });
    });
  });

  mochadoc.section("`real`", () => {
    mochadoc.summary("Real number handling");
    mochadoc.usage(usage("real"));
    mochadoc.description(() => {
      /**
       * The `real` command is a type command dedicated to real values.
       *
       * Real values are Helena values whose internal type is `REAL`.
       */
    });

    mochadoc.section("Real conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `real`
         * will ensure a real value in return. This property means that `real`
         * can be used for creation and conversion, but also as a type guard in
         * argspecs.
         */
      });

      it("should return real value", () => {
        expect(evaluate("real 0")).to.eql(REAL(0));
      });

      describe("Exceptions", () => {
        specify("values with no string representation", () => {
          expect(execute("real []")).to.eql(
            ERROR("value has no string representation")
          );
          expect(execute("real ()")).to.eql(
            ERROR("value has no string representation")
          );
        });
        specify("invalid values", () => {
          expect(execute("real a")).to.eql(ERROR('invalid number "a"'));
        });
      });

      mochadoc.section("Subcommands", () => {
        mochadoc.description(() => {
          /**
           * The `real` ensemble comes with a number of predefined subcommands
           * listed here.
           */
        });

        mochadoc.section("Introspection", () => {
          describe("`subcommands`", () => {
            it("should return list of subcommands", () => {
              /**
               * This subcommand is useful for introspection and interactive
               * calls.
               */
              expect(evaluate('real "" subcommands')).to.eql(
                evaluate("list (subcommands)")
              );
            });

            describe("Exceptions", () => {
              specify("wrong arity", () => {
                /**
                 * The subcommand will return an error message with usage when
                 * given the wrong number of arguments.
                 */
                expect(execute('real "" subcommands a')).to.eql(
                  ERROR('wrong # args: should be "real value subcommands"')
                );
              });
            });
          });
        });

        mochadoc.section("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute('real "" unknownSubcommand')).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute('real "" []')).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `real` is an ensemble command, which means that it is a collection of
         * subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e.
         * `[real]`.
         */
        expect(evaluate("real").type).to.eql(commandValueType);
        expect(evaluate("real")).to.be.instanceOf(EnsembleValue);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `real` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [real] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("real example foo")).to.eql(STR("bar"));
      });

      mochadoc.section("Examples", () => {
        example("Adding a `positive` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `positive` macro within the `real` ensemble
               * scope, returning whether the value is strictly positive:
               */
            },
            script: `
              [real] eval {
                macro positive {value} {
                  $value > 0
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `positive` just like the predefined `real`
               * subcommands:
               */
            },
            script: "real 0.1 positive",
            result: TRUE,
          },
          {
            script: "real 0 positive",
            result: FALSE,
          },
          {
            script: "real -1 positive",
            result: FALSE,
          },
        ]);
      });
    });
  });
});
