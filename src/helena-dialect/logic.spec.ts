import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import {
  BREAK,
  CONTINUE,
  ERROR,
  OK,
  ResultCode,
  RETURN,
} from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, TRUE, NIL, STR, StringValue } from "../core/values";
import { CommandValue, commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena logic operations", () => {
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
    return codeBlock(asString(evaluate("help " + script)));
  };
  const example = specifyExample(({ script }) => execute(script));

  beforeEach(init);

  mochadoc.meta({ toc: true });

  describe("Booleans", () => {
    mochadoc.usage(usage("true") + "\n" + usage("false"));
    mochadoc.description(() => {
      /**
       * Boolean values (or booleans) are Helena values whose internal type is
       * `BOOLEAN`.
       */
    });

    it("are valid commands", () => {
      /**
       * Boolean `true` and `false` are regular commands.
       */
      expect(evaluate("true")).to.eql(TRUE);
      expect(evaluate("false")).to.eql(FALSE);
    });
    it("are idempotent", () => {
      /**
       * Argument-less boolean commands return themselves.
       */
      expect(evaluate("[true]")).to.eql(TRUE);
      expect(evaluate("[false]")).to.eql(FALSE);
    });

    mochadoc.section("Infix operators", () => {
      mochadoc.description(() => {
        /**
         * A boolean followed by an operator can be used for expressions in
         * infix notation.
         */
      });

      mochadoc.section("Conditional", () => {
        describe("`?`", () => {
          mochadoc.summary("Conditional operator");
          mochadoc.description(usage("true ?") + "\n" + usage("false ?"));
          mochadoc.description(() => {
            /**
             * The `?` operator conditionally returns a truthy vs. falsy value.
             */
          });

          describe("`true`", () => {
            it("should return first argument", () => {
              expect(evaluate("true ? a b")).to.eql(STR("a"));
            });
            it("should support a single argument", () => {
              expect(evaluate("true ? a")).to.eql(STR("a"));
            });
          });
          describe("`false`", () => {
            it("should return nil if no second argument is given", () => {
              expect(evaluate("false ? a")).to.eql(NIL);
            });
            it("should return second argument", () => {
              expect(evaluate("false ? a b")).to.eql(STR("b"));
            });
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("true ?")).to.eql(
                ERROR('wrong # args: should be "true ? arg ?arg?"')
              );
              expect(execute("true ? a b c")).to.eql(
                ERROR('wrong # args: should be "true ? arg ?arg?"')
              );
              expect(execute("help true ? a b c")).to.eql(
                ERROR('wrong # args: should be "true ? arg ?arg?"')
              );
              expect(execute("false ?")).to.eql(
                ERROR('wrong # args: should be "false ? arg ?arg?"')
              );
              expect(execute("false ? a b c")).to.eql(
                ERROR('wrong # args: should be "false ? arg ?arg?"')
              );
              expect(execute("help false ? a b c")).to.eql(
                ERROR('wrong # args: should be "false ? arg ?arg?"')
              );
            });
          });
        });

        describe("`!?`", () => {
          mochadoc.summary("Reverse conditional operator");
          mochadoc.description(usage("true !?") + "\n" + usage("false !?"));
          mochadoc.description(() => {
            /**
             * The `!?` operator conditionally returns a falsy vs. truthy value.
             * It is the opposite of `?`.
             */
          });

          describe("`true`", () => {
            it("should return nil if no second argument is given", () => {
              expect(evaluate("true !? a")).to.eql(NIL);
            });
            it("should return second argument", () => {
              expect(evaluate("true !? a b")).to.eql(STR("b"));
            });
          });
          describe("`false`", () => {
            it("should return first argument", () => {
              expect(evaluate("false !? a b")).to.eql(STR("a"));
            });
            it("should support a single argument", () => {
              expect(evaluate("false !? a")).to.eql(STR("a"));
            });
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("true !?")).to.eql(
                ERROR('wrong # args: should be "true !? arg ?arg?"')
              );
              expect(execute("true !? a b c")).to.eql(
                ERROR('wrong # args: should be "true !? arg ?arg?"')
              );
              expect(execute("help true !? a b c")).to.eql(
                ERROR('wrong # args: should be "true !? arg ?arg?"')
              );
              expect(execute("false !?")).to.eql(
                ERROR('wrong # args: should be "false !? arg ?arg?"')
              );
              expect(execute("false !? a b c")).to.eql(
                ERROR('wrong # args: should be "false !? arg ?arg?"')
              );
              expect(execute("help false !? a b c")).to.eql(
                ERROR('wrong # args: should be "false !? arg ?arg?"')
              );
            });
          });
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * Apart from operators, boolean commands accept the subcommands listed
         * here.
         */
      });

      mochadoc.section("Introspection", () => {
        describe("`subcommands`", () => {
          mochadoc.description(
            usage("true subcommands") + "\n" + usage("false subcommands")
          );
          mochadoc.description(() => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
          });
          it("should return list of subcommands", () => {
            expect(evaluate("true subcommands")).to.eql(
              evaluate("list (subcommands ? !?)")
            );
            expect(evaluate("false subcommands")).to.eql(
              evaluate("list (subcommands ? !?)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("true subcommands a")).to.eql(
                ERROR('wrong # args: should be "true subcommands"')
              );
              expect(execute("help true subcommands a")).to.eql(
                ERROR('wrong # args: should be "true subcommands"')
              );
              expect(execute("false subcommands a")).to.eql(
                ERROR('wrong # args: should be "false subcommands"')
              );
              expect(execute("help false subcommands a")).to.eql(
                ERROR('wrong # args: should be "false subcommands"')
              );
            });
          });
        });
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("unknown subcommand", () => {
        expect(execute("true unknownSubcommand")).to.eql(
          ERROR('unknown subcommand "unknownSubcommand"')
        );
        expect(execute("false unknownSubcommand")).to.eql(
          ERROR('unknown subcommand "unknownSubcommand"')
        );
      });
      specify("invalid subcommand name", () => {
        expect(execute("true []")).to.eql(ERROR("invalid subcommand name"));
        expect(execute("false []")).to.eql(ERROR("invalid subcommand name"));
      });
    });
  });

  describeCommand("bool", () => {
    mochadoc.summary("Boolean handling");
    mochadoc.usage(usage("bool"));
    mochadoc.description(() => {
      /**
       * The `bool` command is a type command dedicated to boolean values.
       *
       * Boolean values are Helena values whose internal type is `BOOLEAN`. The
       * name `bool` was preferred over `boolean` because it is shorter and is
       * already used in many other languages like Python and C.
       */
    });

    mochadoc.section("Boolean conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `bool`
         * will ensure a boolean value in return. This property means that
         * `bool` can be used for creation and conversion, but also as a type
         * guard in argspecs.
         */
      });

      it("should return boolean value", () => {
        expect(evaluate("bool true")).to.eql(TRUE);
        expect(evaluate("bool false")).to.eql(FALSE);
      });

      describe("Exceptions", () => {
        specify("values with no string representation", () => {
          expect(execute("bool []")).to.eql(
            ERROR("value has no string representation")
          );
          expect(execute("bool ()")).to.eql(
            ERROR("value has no string representation")
          );
        });
        specify("invalid values", () => {
          expect(execute("bool a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `bool` ensemble comes with a number of predefined subcommands
         * listed here.
         */
      });

      mochadoc.section("Introspection", () => {
        describe("`subcommands`", () => {
          mochadoc.description(usage("bool 0 subcommands"));
          mochadoc.description(() => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
          });

          specify("usage", () => {
            expect(evaluate("help bool 0 subcommands")).to.eql(
              STR("bool value subcommands")
            );
          });

          it("should return list of subcommands", () => {
            expect(evaluate("bool 0 subcommands")).to.eql(
              evaluate("list (subcommands)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("bool 0 subcommands a")).to.eql(
                ERROR('wrong # args: should be "bool value subcommands"')
              );
              expect(execute("help bool 0 subcommands a")).to.eql(
                ERROR('wrong # args: should be "bool value subcommands"')
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("bool 0 unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("bool 0 []")).to.eql(ERROR("invalid subcommand name"));
        });
      });
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `bool` is an ensemble command, which means that it is a collection
         * of subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[bool]`.
         */
        expect(evaluate("bool").type).to.eql(commandValueType);
        expect(evaluate("bool")).to.be.instanceOf(CommandValue);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `bool` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [bool] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("bool example foo")).to.eql(STR("bar"));
      });
      it("should support help for custom subcommands", () => {
        /**
         * Like all ensemble commands, `bool` have built-in support for `help`
         * on all subcommands that support it.
         */
        evaluate(`
          [bool] eval {
            macro foo {value a b} {idem bar}
          }
        `);
        expect(evaluate("help bool 0 foo")).to.eql(STR("bool value foo a b"));
        expect(execute("help bool 0 foo 1 2 3")).to.eql(
          ERROR('wrong # args: should be "bool value foo a b"')
        );
      });

      mochadoc.section("Examples", () => {
        example("Adding a `xor` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `xor` macro within the `bool` ensemble
               * scope, returning the excusive OR with another value. Notice the
               * use of `bool` as a type guard for both arguments:
               */
            },
            script: `
              [bool] eval {
                macro xor {(bool value1) (bool value2)} {
                  $value1 ? [! $value2] $value2
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `xor` just like the predefined `bool`
               * subcommands:
               */
            },
            script: "bool true xor false",
            result: TRUE,
          },
          {
            script: "bool true xor true",
            result: FALSE,
          },
          {
            script: "bool false xor false",
            result: FALSE,
          },
          {
            script: "bool false xor true",
            result: TRUE,
          },
        ]);
      });
    });
  });

  mochadoc.section("Prefix operators", () => {
    describe("`!`", () => {
      mochadoc.summary("Logical NOT operator");
      mochadoc.description(usage("!"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          expect(evaluate("help !")).to.eql(STR("! arg"));
        });

        it("should invert boolean values", () => {
          expect(evaluate("! true")).to.eql(FALSE);
          expect(evaluate("! false")).to.eql(TRUE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("! {idem true}")).to.eql(FALSE);
          expect(evaluate("! {idem false}")).to.eql(TRUE);
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
          expect(execute("!")).to.eql(ERROR('wrong # args: should be "! arg"'));
          expect(execute("! a b")).to.eql(
            ERROR('wrong # args: should be "! arg"')
          );
          expect(execute("help ! a b")).to.eql(
            ERROR('wrong # args: should be "! arg"')
          );
        });
        specify("invalid value", () => {
          /**
           * Only booleans and scripts are acceptable values.
           */
          expect(execute("! 1")).to.eql(ERROR('invalid boolean "1"'));
          expect(execute("! 1.23")).to.eql(ERROR('invalid boolean "1.23"'));
          expect(execute("! a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });

      mochadoc.section("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If a script expression returns a result code other than `OK` then
           * it should be propagated properly to the caller.
           */
        });

        describe("`return`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("! {return value; unreachable}")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("! {tailcall {idem value}; unreachable}")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`yield`", () => {
          it("should interrupt expression with `YIELD` code", () => {
            const result = execute("! {yield value; true}");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("value"));
          });
          it("should provide a resumable state", () => {
            const process = rootScope.prepareScript(
              parse("! {yield val1; yield val2}")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(TRUE);
            result = process.run();
            expect(result).to.eql(OK(FALSE));
          });
        });
        describe("`error`", () => {
          it("should interrupt expression with `ERROR` code", () => {
            expect(execute("! {error msg; false}")).to.eql(ERROR("msg"));
          });
        });
        describe("`break`", () => {
          it("should interrupt expression with `BREAK` code", () => {
            expect(execute("! {break; unreachable}")).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt expression with `CONTINUE` code", () => {
            expect(execute("! {continue; false}")).to.eql(CONTINUE());
          });
        });
      });
    });

    describe("`&&`", () => {
      mochadoc.summary("Logical AND operator");
      mochadoc.description(usage("&&"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          expect(evaluate("help &&")).to.eql(STR("&& arg ?arg ...?"));
        });

        it("should accept one boolean", () => {
          expect(evaluate("&& false")).to.eql(FALSE);
          expect(evaluate("&& true")).to.eql(TRUE);
        });
        it("should accept two booleans", () => {
          expect(evaluate("&& false false")).to.eql(FALSE);
          expect(evaluate("&& false true")).to.eql(FALSE);
          expect(evaluate("&& true false")).to.eql(FALSE);
          expect(evaluate("&& true true")).to.eql(TRUE);
        });
        it("should accept several booleans", () => {
          expect(evaluate("&&" + " true".repeat(3))).to.eql(TRUE);
          expect(evaluate("&&" + " true".repeat(3) + " false")).to.eql(FALSE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("&& {idem false}")).to.eql(FALSE);
          expect(evaluate("&& {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on `false`", () => {
          expect(evaluate("&& false {unreachable}")).to.eql(FALSE);
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
          expect(execute("&&")).to.eql(
            ERROR('wrong # args: should be "&& arg ?arg ...?"')
          );
        });
        specify("invalid value", () => {
          /**
           * Only booleans and scripts are acceptable values.
           */
          expect(execute("&& a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });

      mochadoc.section("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If a script expression returns a result code other than `OK` then
           * it should be propagated properly to the caller.
           */
        });

        describe("`return`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("&& true {return value; unreachable} false")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(
              execute("&& true {tailcall {idem value}; unreachable} false")
            ).to.eql(RETURN(STR("value")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt expression with `YIELD` code", () => {
            const result = execute("&& true {yield value; true}");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("value"));
          });
          it("should provide a resumable state", () => {
            const process = rootScope.prepareScript(
              parse("&& {yield val1} {yield val2} ")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            process.yieldBack(TRUE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(FALSE);
            result = process.run();
            expect(result).to.eql(OK(FALSE));
          });
        });
        describe("`error`", () => {
          it("should interrupt expression with `ERROR` code", () => {
            expect(execute("&& true {error msg; true} false")).to.eql(
              ERROR("msg")
            );
          });
        });
        describe("`break`", () => {
          it("should interrupt expression with `BREAK` code", () => {
            expect(execute("&& true {break; unreachable} false")).to.eql(
              BREAK()
            );
          });
        });
        describe("`continue`", () => {
          it("should interrupt expression with `CONTINUE` code", () => {
            expect(execute("&& true {continue; unreachable} false")).to.eql(
              CONTINUE()
            );
          });
        });
      });
    });

    describe("`||`", () => {
      mochadoc.summary("Logical OR operator");
      mochadoc.usage(usage("||"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          expect(evaluate("help ||")).to.eql(STR("|| arg ?arg ...?"));
        });

        it("should accept one boolean", () => {
          expect(evaluate("|| false")).to.eql(FALSE);
          expect(evaluate("|| true")).to.eql(TRUE);
        });
        it("should accept two booleans", () => {
          expect(evaluate("|| false false")).to.eql(FALSE);
          expect(evaluate("|| false true")).to.eql(TRUE);
          expect(evaluate("|| true false")).to.eql(TRUE);
          expect(evaluate("|| true true")).to.eql(TRUE);
        });
        it("should accept several booleans", () => {
          expect(evaluate("||" + " false".repeat(3))).to.eql(FALSE);
          expect(evaluate("||" + " false".repeat(3) + " true")).to.eql(TRUE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("|| {idem false}")).to.eql(FALSE);
          expect(evaluate("|| {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on `true`", () => {
          expect(evaluate("|| true {unreachable}")).to.eql(TRUE);
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
          expect(execute("||")).to.eql(
            ERROR('wrong # args: should be "|| arg ?arg ...?"')
          );
        });
        specify("invalid value", () => {
          /**
           * Only booleans and scripts are acceptable values.
           */
          expect(execute("|| a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });

      mochadoc.section("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If a script expression returns a result code other than `OK` then
           * it should be propagated properly to the caller.
           */
        });

        describe("`return`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("|| false {return value; unreachable} true")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(
              execute("|| false {tailcall {idem value}; unreachable} true")
            ).to.eql(RETURN(STR("value")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt expression with `YIELD` code", () => {
            const result = execute("|| false {yield value; false}");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("value"));
          });
          it("should provide a resumable state", () => {
            const process = rootScope.prepareScript(
              parse("|| {yield val1} {yield val2} ")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            process.yieldBack(FALSE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(TRUE);
            result = process.run();
            expect(result).to.eql(OK(TRUE));
          });
        });
        describe("`error`", () => {
          it("should interrupt expression with `ERROR` code", () => {
            expect(execute("|| false {error msg; true} true")).to.eql(
              ERROR("msg")
            );
          });
        });
        describe("`break`", () => {
          it("should interrupt expression with `BREAK` code", () => {
            expect(execute("|| false {break; unreachable} true")).to.eql(
              BREAK()
            );
          });
        });
        describe("`continue`", () => {
          it("should interrupt expression with `CONTINUE` code", () => {
            expect(execute("|| false {continue; unreachable} true")).to.eql(
              CONTINUE()
            );
          });
        });
      });
    });
  });
});
