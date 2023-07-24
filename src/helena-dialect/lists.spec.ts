import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, LIST, NIL, STR, TRUE } from "../core/values";
import { Scope, commandValueType } from "./core";
import { initCommands } from "./helena-dialect";
import { displayListValue } from "./lists";
import { codeBlock, specifyExample } from "./test-helpers";
import { EnsembleMetacommand } from "./ensembles";

describe("Helena lists", () => {
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

  mochadoc.section("`list`", () => {
    mochadoc.summary("List handling");
    mochadoc.usage(usage("list"));
    mochadoc.description(() => {
      /**
       * The `list` command is a type command dedicated to list values. It
       * provides an ensemble of subcommands for list creation, conversion,
       * access, and operations.
       *
       * List values are Helena values whose internal type is `LIST`.
       */
    });

    mochadoc.section("List creation and conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `list`
         * will ensure a list value in return. This property means that `list`
         * can be used for creation and conversion, but also as a type guard in
         * argspecs.
         */
      });

      it("should return list value", () => {
        expect(evaluate("list ()")).to.eql(LIST([]));
      });
      example("should convert tuples to lists", {
        doc: () => {
          /**
           * The most common syntax for list creation is to simply pass a tuple
           * of elements.
           */
        },
        script: "list (a b c)",
        result: LIST([STR("a"), STR("b"), STR("c")]),
      });
      example("should convert blocks to lists", {
        doc: () => {
          /**
           * Blocks are also accepted; the block is evaluated in an empty scope
           * and each resulting word is added to the list in order.
           */
        },
        script: "list {a b c}",
        result: LIST([STR("a"), STR("b"), STR("c")]),
      });

      describe("Exceptions", () => {
        specify("invalid values", () => {
          /**
           * Only lists, tuples, and blocks are acceptable values.
           */
          expect(execute("list []")).to.eql(ERROR("invalid list"));
          expect(execute("list [1]")).to.eql(ERROR("invalid list"));
          expect(execute("list a")).to.eql(ERROR("invalid list"));
        });
        specify("blocks with side effects", () => {
          /**
           * Providing a block with side effects like substitutions or
           * expressions will result in an error.
           */
          expect(execute("list { $a }")).to.eql(ERROR("invalid list"));
          expect(execute("list { [b] }")).to.eql(ERROR("invalid list"));
          expect(execute("list { $[][a] }")).to.eql(ERROR("invalid list"));
          expect(execute("list { $[](a) }")).to.eql(ERROR("invalid list"));
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `list` ensemble comes with a number of predefined subcommands
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
            expect(evaluate("list {} subcommands")).to.eql(
              evaluate(
                "list (subcommands length at range append remove insert replace foreach)"
              )
            );
          });
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            expect(execute("list {} subcommands a")).to.eql(
              ERROR('wrong # args: should be "list value subcommands"')
            );
          });
        });
      });

      mochadoc.section("Accessors", () => {
        describe("`length`", () => {
          it("should return the list length", () => {
            expect(evaluate("list () length")).to.eql(INT(0));
            expect(evaluate("list (a b c) length")).to.eql(INT(3));
          });
          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list () length a")).to.eql(
                ERROR('wrong # args: should be "list value length"')
              );
            });
          });
        });

        describe("`at`", () => {
          it("should return the element at the given index", () => {
            expect(evaluate("list (a b c) at 1")).to.eql(STR("b"));
          });
          it("should return the default value for an out-of-range index", () => {
            expect(evaluate("list (a b c) at 10 default")).to.eql(
              STR("default")
            );
          });
          specify("`at` <-> indexed selector equivalence", () => {
            rootScope.setNamedVariable(
              "v",
              LIST([STR("a"), STR("b"), STR("c")])
            );
            evaluate("set l (list $v)");

            expect(execute("list $v at 2")).to.eql(execute("idem $v[2]"));
            expect(execute("$l at 2")).to.eql(execute("idem $v[2]"));
            expect(execute("idem $[$l][2]")).to.eql(execute("idem $v[2]"));

            expect(execute("list $l at -1")).to.eql(execute("idem $v[-1]"));
            expect(execute("$l at -1")).to.eql(execute("idem $v[-1]"));
            expect(execute("idem $[$l][-1]")).to.eql(execute("idem $v[-1]"));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list (a b c) at")).to.eql(
                ERROR('wrong # args: should be "list value at index ?default?"')
              );
              expect(execute("list (a b c) at a b c")).to.eql(
                ERROR('wrong # args: should be "list value at index ?default?"')
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) at a")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("index out of range", () => {
              expect(execute("list (a b c) at -1")).to.eql(
                ERROR('index out of range "-1"')
              );
              expect(execute("list (a b c) at 10")).to.eql(
                ERROR('index out of range "10"')
              );
            });
          });
        });
      });

      mochadoc.section("List operations", () => {
        describe("`range`", () => {
          it("should return the list included within [first, last]", () => {
            expect(evaluate("list (a b c d e f) range 1 3")).to.eql(
              evaluate("list (b c d)")
            );
          });
          it("should return the remainder of the list when given first only", () => {
            expect(evaluate("list (a b c) range 2")).to.eql(
              evaluate("list (c)")
            );
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("list (a b c) range -1")).to.eql(
              evaluate("list (a b c)")
            );
            expect(evaluate("list (a b c) range -10 1")).to.eql(
              evaluate("list (a b)")
            );
            expect(evaluate("list (a b c) range 2 10")).to.eql(
              evaluate("list (c)")
            );
            expect(evaluate("list (a b c) range -2 10")).to.eql(
              evaluate("list (a b c)")
            );
          });
          it("should return an empty list when last is before first", () => {
            expect(evaluate("list (a b c) range 2 0")).to.eql(LIST([]));
          });
          it("should return an empty list when first is past the list length", () => {
            expect(evaluate("list (a b c) range 10 12")).to.eql(
              evaluate("list ()")
            );
          });
          it("should return an empty list when last is negative", () => {
            expect(evaluate("list (a b c) range -3 -1")).to.eql(
              evaluate("list ()")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list (a b c) range")).to.eql(
                ERROR('wrong # args: should be "list value range first ?last?"')
              );
              expect(execute("list (a b c) range a b c")).to.eql(
                ERROR('wrong # args: should be "list value range first ?last?"')
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) range a")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("list (a b c) range 1 b")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
          });
        });

        describe("`remove`", () => {
          it("should remove the range included within [first, last]", () => {
            expect(evaluate("list (a b c d e f) remove 1 3")).to.eql(
              evaluate("list (a e f)")
            );
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("list (a b c) remove -10 1")).to.eql(
              evaluate("list (c)")
            );
            expect(evaluate("list (a b c) remove 2 10")).to.eql(
              evaluate("list (a b)")
            );
            expect(evaluate("list (a b c) remove -2 10")).to.eql(
              evaluate("list ()")
            );
          });
          it("should do nothing when last is before first", () => {
            expect(evaluate("list (a b c) remove 2 0")).to.eql(
              evaluate("list (a b c)")
            );
          });
          it("should do nothing when last is negative", () => {
            expect(evaluate("list (a b c) remove -3 -1")).to.eql(
              evaluate("list (a b c)")
            );
          });
          it("should do nothing when first is past the list length", () => {
            expect(evaluate("list (a b c) remove 10 12")).to.eql(
              evaluate("list (a b c)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list (a b c) remove a")).to.eql(
                ERROR('wrong # args: should be "list value remove first last"')
              );
              expect(execute("list (a b c) remove a b c d")).to.eql(
                ERROR('wrong # args: should be "list value remove first last"')
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) remove a b")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("list (a b c) remove 1 b")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
          });
        });

        describe("`append`", () => {
          it("should append two lists", () => {
            expect(evaluate("list (a b c) append (foo bar)")).to.eql(
              evaluate("list (a b c foo bar)")
            );
          });
          it("should accept several lists", () => {
            expect(
              evaluate("list (a b c) append (foo bar) (baz) (sprong yada)")
            ).to.eql(evaluate("list (a b c foo bar baz sprong yada)"));
          });
          it("should accept zero list", () => {
            expect(evaluate("list (a b c) append")).to.eql(
              evaluate("list (a b c)")
            );
          });

          describe("Exceptions", () => {
            specify("invalid values", () => {
              expect(execute("list (a b c) append []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) append [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) append a")).to.eql(
                ERROR("invalid list")
              );
            });
          });
        });

        describe("`insert`", () => {
          it("should insert the list at the given index", () => {
            expect(evaluate("list (a b c) insert 1 (foo bar)")).to.eql(
              evaluate("list (a foo bar b c)")
            );
          });
          it("should prepend the list when index is negative", () => {
            expect(evaluate("list (a b c) insert -10 (foo bar)")).to.eql(
              evaluate("list (foo bar a b c)")
            );
          });
          it("should append the list when index is past the list length", () => {
            expect(evaluate("list (a b c) insert 10 (foo bar)")).to.eql(
              evaluate("list (a b c foo bar)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list (a b c) insert a")).to.eql(
                ERROR('wrong # args: should be "list value insert index new"')
              );
              expect(execute("list (a b c) insert a b c")).to.eql(
                ERROR('wrong # args: should be "list value insert index new"')
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) insert a b")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("invalid values", () => {
              expect(execute("list (a b c) insert 1 []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) append [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) insert 1 a")).to.eql(
                ERROR("invalid list")
              );
            });
          });
        });

        describe("`replace`", () => {
          it("should replace the range included within [first, last] with the given list", () => {
            expect(evaluate("list (a b c d e) replace 1 3 (foo bar)")).to.eql(
              evaluate("list (a foo bar e)")
            );
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("list (a b c) replace -10 1 (foo bar)")).to.eql(
              evaluate("list (foo bar c)")
            );
            expect(evaluate("list (a b c) replace 2 10 (foo bar)")).to.eql(
              evaluate("list (a b foo bar)")
            );
            expect(evaluate("list (a b c) replace -2 10 (foo bar)")).to.eql(
              evaluate("list (foo bar)")
            );
          });
          it("should insert the list at first index when last is before first", () => {
            expect(evaluate("list (a b c) replace 2 0 (foo bar)")).to.eql(
              evaluate("list (a b foo bar c)")
            );
          });
          it("should prepend the list when last is negative", () => {
            expect(evaluate("list (a b c) replace -3 -1 (foo bar)")).to.eql(
              evaluate("list (foo bar a b c)")
            );
          });
          it("should append the list when first is past the list length", () => {
            expect(evaluate("list (a b c) replace 10 12 (foo bar)")).to.eql(
              evaluate("list (a b c foo bar)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list (a b c) replace a b")).to.eql(
                ERROR(
                  'wrong # args: should be "list value replace first last new"'
                )
              );
              expect(execute("list (a b c) replace a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "list value replace first last new"'
                )
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) replace a b c")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("list (a b c) replace 1 b c")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
            specify("invalid values", () => {
              expect(execute("list (a b c) replace 1 1 []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) replace 1 1 [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) replace 1 1 a")).to.eql(
                ERROR("invalid list")
              );
            });
          });
        });
      });

      mochadoc.section("Iteration", () => {
        describe("`foreach`", () => {
          it("should iterate over elements", () => {
            evaluate(`
            set elements [list ()]
            set l [list (a b c)]
            list $l foreach element {
              set elements [list $elements append ($element)]
            }
            `);
            expect(evaluate("get elements")).to.eql(evaluate("get l"));
          });
          it("should return the result of the last command", () => {
            expect(execute("list () foreach element {}")).to.eql(OK(NIL));
            expect(execute("list (a b c) foreach element {}")).to.eql(OK(NIL));
            expect(
              evaluate("set i 0; list (a b c) foreach element {set i [+ $i 1]}")
            ).to.eql(INT(3));
          });

          describe("Control flow", () => {
            describe("`return`", () => {
              it("should interrupt the loop with `RETURN` code", () => {
                expect(
                  execute(
                    "set i 0; list (a b c) foreach element {set i [+ $i 1]; return $element; unreachable}"
                  )
                ).to.eql(execute("return a"));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`tailcall`", () => {
              it("should interrupt the loop with `RETURN` code", () => {
                expect(
                  execute(
                    "set i 0; list (a b c) foreach element {set i [+ $i 1]; tailcall {idem $element}; unreachable}"
                  )
                ).to.eql(execute("return a"));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`yield`", () => {
              it("should interrupt the body with `YIELD` code", () => {
                expect(
                  execute("list (a b c) foreach element {yield; unreachable}")
                    .code
                ).to.eql(ResultCode.YIELD);
              });
              it("should provide a resumable state", () => {
                const process = rootScope.prepareScript(
                  parse(
                    "list (a b c) foreach element {idem _$[yield $element]_}"
                  )
                );

                let result = process.run();
                expect(result.code).to.eql(ResultCode.YIELD);
                expect(result.value).to.eql(STR("a"));
                expect(result.data).to.exist;

                process.yieldBack(STR("step 1"));
                result = process.run();
                expect(result.code).to.eql(ResultCode.YIELD);
                expect(result.value).to.eql(STR("b"));
                expect(result.data).to.exist;

                process.yieldBack(STR("step 2"));
                result = process.run();
                expect(result.code).to.eql(ResultCode.YIELD);
                expect(result.value).to.eql(STR("c"));
                expect(result.data).to.exist;

                process.yieldBack(STR("step 3"));
                result = process.run();
                expect(result).to.eql(OK(STR("_step 3_")));
              });
            });
            describe("`error`", () => {
              it("should interrupt the loop with `ERROR` code", () => {
                expect(
                  execute(
                    "set i 0; list (a b c) foreach element {set i [+ $i 1]; error msg; unreachable}"
                  )
                ).to.eql(ERROR("msg"));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`break`", () => {
              it("should interrupt the body with nil result", () => {
                expect(
                  execute(
                    "set i 0; list (a b c) foreach element {set i [+ $i 1]; break; unreachable}"
                  )
                ).to.eql(OK(NIL));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`continue`", () => {
              it("should interrupt the body iteration", () => {
                expect(
                  execute(
                    "set i 0; list (a b c) foreach element {set i [+ $i 1]; continue; unreachable}"
                  )
                ).to.eql(OK(NIL));
                expect(evaluate("get i")).to.eql(INT(3));
              });
            });
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("list (a b c) foreach a")).to.eql(
                ERROR(
                  'wrong # args: should be "list value foreach element body"'
                )
              );
              expect(execute("list (a b c) foreach a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "list value foreach element body"'
                )
              );
            });
            specify("non-script body", () => {
              expect(execute("list (a b c) foreach a b")).to.eql(
                ERROR("body must be a script")
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("list () unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("list () []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });

    mochadoc.section("Examples", () => {
      example("Currying and encapsulation", [
        {
          doc: () => {
            /**
             * Thanks to leading tuple auto-expansion, it is very simple to
             * bundle the `list` command and a value into a tuple to create a
             * pseudo-object value. For example:
             */
          },
          script: "set l (list (a b c d e f g))",
        },
        {
          doc: () => {
            /**
             * We can then use this variable like a regular command. Calling it
             * without argument will return the wrapped value:
             */
          },
          script: "$l",
          result: evaluate("list (a b c d e f g)"),
        },
        {
          doc: () => {
            /**
             * Subcommands then behave like object methods:
             */
          },
          script: "$l length",
          result: INT(7),
        },
        {
          script: "$l at 2",
          result: STR("c"),
        },
        {
          script: "$l range 3 5",
          result: evaluate("list (d e f)"),
        },
      ]);
      example("Argument type guard", [
        {
          doc: () => {
            /**
             * Calling `list` with a single argument returns its value as a
             * list. This property allows `list` to be used as a type guard for
             * argspecs.
             *
             * Here we create a macro `len` that returns the length of the
             * provided list. Using `list` as guard has three effects:
             *
             * - it validates the argument on the caller side
             * - it converts the value at most once
             * - it ensures type safety within the body
             *
             * Note how using `list` as a guard for argument `l` makes it look
             * like a static type declaration:
             */
          },
          script: "macro len ( (list l) ) {list $l length}",
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
             * Passing an invalid value will produce an error:
             */
          },
          script: "len invalidValue",
          result: ERROR("invalid list"),
        },
      ]);
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `list` is an ensemble command, which means that it is a collection of
         * subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[list]`.
         */
        expect(evaluate("list").type).to.eql(commandValueType);
        expect(evaluate("list")).to.be.instanceOf(EnsembleMetacommand);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `list` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [list] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("list (a b c) foo")).to.eql(STR("bar"));
      });

      mochadoc.section("Examples", () => {
        example("Adding a `last` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `last` macro within the `list` ensemble scope,
               * returning the last element of the provided list value:
               */
            },
            script: `
              [list] eval {
                macro last {value} {
                  list $value at [- [list $value length] 1]
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `last` just like the predefined `list`
               * subcommands:
               */
            },
            script: "list (a b c) last",
            result: STR("c"),
          },
        ]);
        example("Using `foreach` to implement a `includes` subcommand", [
          {
            doc: () => {
              /**
               * Faithful to its minimalist philosophy, Helena only provides
               * basic subcommands that can serve as building blocks to
               * implement other subcommands. Here we add a `includes` predicate
               * that tests whether a given value is present in a list,
               * leveraging the built-in `foreach` subcommand to iterate over
               * the list elements:
               */
            },
            script: `
              [list] eval {
                proc includes {haystack needle} {
                  list $haystack foreach element {
                    if [string $needle == $element] {return [true]}
                  }
                  return [false]
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * (Note how we are free to name subcommand arguments however we
               * want)
               *
               * We can then use `includes` just like the predefined `list`
               * subcommands:
               */
            },
            script: "list (a b c) includes b",
            result: TRUE,
          },
          {
            script: "list (a b c) includes d",
            result: FALSE,
          },
        ]);
      });
    });
  });

  mochadoc.section("`displayListValue`", () => {
    mochadoc.summary("Display function for lists");

    it("should display lists as `list` command + tuple values", () => {
      const list = LIST([STR("a"), STR("b"), STR("c")]);
      expect(displayListValue(list)).to.eql("[list (a b c)]");
    });
    it("should produce an isomorphic string", () => {
      /**
       * Evaluating the string will produce an identical list value.
       */
      const list = LIST([STR("a"), STR("b"), STR("c")]);
      expect(evaluate(`idem ${displayListValue(list)}`)).to.eql(list);
    });
  });
});
