import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { INT, STR, TUPLE } from "../core/values";
import { Scope, commandValueType } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, specifyExample } from "./test-helpers";
import { EnsembleMetacommand } from "./ensembles";

describe("Helena tuples", () => {
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

  describe("`tuple`", () => {
    mochadoc.summary("Tuple handling");
    mochadoc.usage(usage("tuple"));
    mochadoc.description(() => {
      /**
       * The `tuple` command is a type command dedicated to tuple values. It
       * provides an ensemble of subcommands for tuple creation, conversion,
       * access, and operations.
       *
       * Tuple values are Helena values whose internal type is `TUPLE`.
       */
    });

    mochadoc.section("Tuple creation and conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `tuple`
         * will ensure a tuple value in return. This property means that `tuple`
         * can be used for creation and conversion, but also as a type guard in
         * argspecs.
         */
      });

      it("should return tuple value", () => {
        expect(evaluate("tuple ()")).to.eql(TUPLE([]));
      });
      it("should convert lists to tuple", () => {
        expect(evaluate("tuple [list (a b c)]")).to.eql(
          TUPLE([STR("a"), STR("b"), STR("c")])
        );
      });
      example("should convert blocks to tuples", {
        doc: () => {
          /**
           * Blocks are also accepted; the block is evaluated in an empty scope
           * and each resulting word is added to the tuple in order.
           */
        },
        script: "tuple {a b c}",
        result: TUPLE([STR("a"), STR("b"), STR("c")]),
      });

      describe("Exceptions", () => {
        specify("invalid values", () => {
          /**
           * Only tuples, lists, and blocks are acceptable values.
           */
          expect(execute("tuple []")).to.eql(ERROR("invalid tuple"));
          expect(execute("tuple [1]")).to.eql(ERROR("invalid tuple"));
          expect(execute("tuple a")).to.eql(ERROR("invalid tuple"));
        });
        specify("blocks with side effects", () => {
          /**
           * Providing a block with side effects like substitutions or
           * expressions will result in an error.
           */
          expect(execute("tuple { $a }")).to.eql(ERROR("invalid list"));
          expect(execute("tuple { [b] }")).to.eql(ERROR("invalid list"));
          expect(execute("tuple { $[][a] }")).to.eql(ERROR("invalid list"));
          expect(execute("tuple { $[](a) }")).to.eql(ERROR("invalid list"));
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `tuple` ensemble comes with a number of predefined subcommands
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
            expect(evaluate("tuple () subcommands")).to.eql(
              evaluate("list (subcommands length at)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("tuple () subcommands a")).to.eql(
                ERROR('wrong # args: should be "tuple value subcommands"')
              );
            });
          });
        });
      });

      mochadoc.section("Accessors", () => {
        describe("`length`", () => {
          it("should return the tuple length", () => {
            expect(evaluate("tuple () length")).to.eql(INT(0));
            expect(evaluate("tuple (a b c) length")).to.eql(INT(3));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("tuple () length a")).to.eql(
                ERROR('wrong # args: should be "tuple value length"')
              );
            });
          });
        });

        describe("`at`", () => {
          it("should return the element at the given index", () => {
            expect(evaluate("tuple (a b c) at 1")).to.eql(STR("b"));
          });
          it("should return the default value for an out-of-range index", () => {
            expect(evaluate("tuple (a b c) at 10 default")).to.eql(
              STR("default")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("tuple (a b c) at")).to.eql(
                ERROR(
                  'wrong # args: should be "tuple value at index ?default?"'
                )
              );
              expect(execute("tuple (a b c) at a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "tuple value at index ?default?"'
                )
              );
            });
            specify("invalid index", () => {
              expect(execute("tuple (a b c) at a")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("index out of range", () => {
              expect(execute("tuple (a b c) at -1")).to.eql(
                ERROR('index out of range "-1"')
              );
              expect(execute("tuple (a b c) at 10")).to.eql(
                ERROR('index out of range "10"')
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("tuple () unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("tuple () []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });

      it("should be extensible", () => {
        evaluate(
          `[tuple] eval {
            macro last {value} {
              tuple $value at [- [tuple $value length] 1]
            }
          }`
        );
        expect(evaluate("tuple (a b c) last")).to.eql(STR("c"));
      });
    });
    mochadoc.section("Examples", () => {
      example("Currying and encapsulation", [
        {
          doc: () => {
            /**
             * Thanks to leading tuple auto-expansion, it is very simple to
             * bundle the `tuple` command and a value into a tuple to create a
             * pseudo-object value. For example:
             */
          },
          script: "set t (tuple (a b c d e f g))",
        },
        {
          doc: () => {
            /**
             * We can then use this variable like a regular command. Calling it
             * without argument will return the wrapped value:
             */
          },
          script: "$t",
          result: evaluate("tuple (a b c d e f g)"),
        },
        {
          doc: () => {
            /**
             * Subcommands then behave like object methods:
             */
          },
          script: "$t length",
          result: INT(7),
        },
        {
          script: "$t at 2",
          result: STR("c"),
        },
      ]);
      example("Argument type guard", [
        {
          doc: () => {
            /**
             * Calling `tuple` with a single argument returns its value as a
             * tuple. This property allows `tuple` to be used as a type guard
             * for argspecs.
             *
             * Here we create a macro `len` that returns the length of the
             * provided tuple. Using `tuple` as guard has three effects:
             *
             * - it validates the argument on the caller side
             * - it converts the value at most once
             * - it ensures type safety within the body
             *
             * Note how using `tuple` as a guard for argument `t` makes it look
             * like a static type declaration:
             */
          },
          script: "macro len ( (tuple t) ) {tuple $t length}",
        },
        {
          doc: () => {
            /**
             * Passing a valid value will give the expected result:
             */
          },
          script: "len (1 2 3 4)",
          result: INT(4),
        },
        {
          doc: () => {
            /**
             * Conversions are implicit:
             */
          },
          script: "len [list {1 2 3}]",
          result: INT(3),
        },
        {
          doc: () => {
            /**
             * Passing an invalid value will produce an error:
             */
          },
          script: "len invalidValue",
          result: ERROR("invalid tuple"),
        },
      ]);
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `tuple` is an ensemble command, which means that it is a collection
         * of subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[tuple]`.
         */
        expect(evaluate("tuple").type).to.eql(commandValueType);
        expect(evaluate("tuple")).to.be.instanceOf(EnsembleMetacommand);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `tuple` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [tuple] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("tuple (a b c) foo")).to.eql(STR("bar"));
      });

      mochadoc.section("Examples", () => {
        example("Adding a `last` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `last` macro within the `tuple` ensemble
               * scope, returning the last element of the provided tuple value:
               */
            },
            script: `
              [tuple] eval {
                macro last {value} {
                  tuple $value at [- [tuple $value length] 1]
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `last` just like the predefined `tuple`
               * subcommands:
               */
            },
            script: "tuple (a b c) last",
            result: STR("c"),
          },
        ]);
      });
    });
  });
});
