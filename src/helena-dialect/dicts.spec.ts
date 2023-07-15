import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, MAP, NIL, STR, TRUE, TUPLE } from "../core/values";
import { Scope, commandValueType } from "./core";
import { initCommands } from "./helena-dialect";
import { displayMapValue } from "./dicts";
import { codeBlock, specifyExample } from "./test-helpers";
import { EnsembleValue } from "./ensembles";

describe("Helena dictionaries", () => {
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

  describe("`dict`", () => {
    mochadoc.summary("Dictionary handling");
    mochadoc.usage(usage("dict"));
    mochadoc.description(() => {
      /**
       * The `dict` command is a type command dedicated to dictionary values. It
       * provides an ensemble of subcommands for dictionary creation,
       * conversion, access, and operations.
       *
       * Dictionary values are Helena values whose internal type is `MAP`. The
       * name `dict` was preferred over `map` and alternatives for several
       * reasons:
       * - `map` is the name of a list transform function in other languages
       * (e.g. JavaScript) and this could bring confusion
       * - `dict` is the name used in Tcl
       * - `dictionary` is too verbose
       */
    });

    mochadoc.section("Dictionary creation and conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `dict`
         * will ensure a dictionary value in return. This property means that
         * `dict` can be used for creation and conversion, but also as a type
         * guard in argspecs.
         */
      });

      it("should return map value", () => {
        expect(evaluate("dict ()")).to.eql(MAP({}));
      });
      example("should convert key-value tuples to maps", {
        doc: () => {
          /**
           * The most common syntax for dictionary creation is to simply pass a
           * tuple of key-value elements.
           */
        },
        script: "dict (a b c d)",
        result: MAP({
          a: STR("b"),
          c: STR("d"),
        }),
      });
      example("should convert key-value blocks to maps", {
        doc: () => {
          /**
           * Blocks are also accepted; the block is evaluated in an empty scope
           * and the resulting key-value tuple is used for creation.
           */
        },
        script: "dict {a b c d}",
        result: MAP({
          a: STR("b"),
          c: STR("d"),
        }),
      });
      example("should convert key-value lists to maps", {
        doc: () => {
          /**
           * Key-value lists are also accepted.
           */
        },
        script: "dict [list (a b c d)]",
        result: MAP({
          a: STR("b"),
          c: STR("d"),
        }),
      });
      it("should convert non-string keys to strings", () => {
        /**
         * Dictionaries only support string keys internally; any value having a
         * valid string representation can be used as key.
         */
        expect(evaluate("dict ([1] a [2.5] b [true] c {block} d)")).to.eql(
          MAP({
            "1": STR("a"),
            "2.5": STR("b"),
            true: STR("c"),
            block: STR("d"),
          })
        );
      });
      it("should preserve values", () => {
        /**
         * Contrary to keys, values are preserved with no conversion.
         */
        expect(evaluate("dict (a [1] b () c [])")).to.eql(
          MAP({
            a: INT(1),
            b: TUPLE([]),
            c: NIL,
          })
        );
      });

      describe("Exceptions", () => {
        specify("invalid lists", () => {
          /**
           * Only lists, tuples, and blocks are acceptable values.
           */
          expect(execute("dict []")).to.eql(ERROR("invalid map"));
          expect(execute("dict [1]")).to.eql(ERROR("invalid map"));
          expect(execute("dict a")).to.eql(ERROR("invalid map"));
        });
        specify("invalid keys", () => {
          /**
           * Keys must have a string representation.
           */
          expect(execute("dict ([] a)")).to.eql(ERROR("invalid key"));
          expect(execute("dict (() a)")).to.eql(ERROR("invalid key"));
        });
        specify("odd lists", () => {
          /**
           * Key-value lists are expected, hence lists must have an even length.
           */
          expect(execute("dict (a)")).to.eql(ERROR("invalid key-value list"));
          expect(execute("dict {a b c}")).to.eql(
            ERROR("invalid key-value list")
          );
        });
        specify("blocks with side effects", () => {
          /**
           * Providing a block with side effects like substitutions or
           * expressions will result in an error.
           */
          expect(execute("dict { $a b}")).to.eql(ERROR("invalid list"));
          expect(execute("dict { a [b] }")).to.eql(ERROR("invalid list"));
          expect(execute("dict { $[][a] b}")).to.eql(ERROR("invalid list"));
          expect(execute("dict { a $[](b) }")).to.eql(ERROR("invalid list"));
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `dict` ensemble comes with a number of predefined subcommands
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
            expect(evaluate("dict () subcommands")).to.eql(
              evaluate(
                "list (subcommands size has get add remove merge keys values entries foreach)"
              )
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict () subcommands a")).to.eql(
                ERROR('wrong # args: should be "dict value subcommands"')
              );
            });
          });
        });
      });

      mochadoc.section("Accessors", () => {
        describe("`size`", () => {
          it("should return the map size", () => {
            expect(evaluate("dict () size")).to.eql(INT(0));
            expect(evaluate("dict (a b c d) size")).to.eql(INT(2));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict () size a")).to.eql(
                ERROR('wrong # args: should be "dict value size"')
              );
            });
          });
        });

        describe("`has`", () => {
          it("should test for key presence", () => {
            expect(evaluate("dict (a b c d) has a")).to.eql(TRUE);
            expect(evaluate("dict (a b c d) has e")).to.eql(FALSE);
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict (a b c d) has")).to.eql(
                ERROR('wrong # args: should be "dict value has key"')
              );
              expect(execute("dict (a b c d) has a b")).to.eql(
                ERROR('wrong # args: should be "dict value has key"')
              );
            });
            specify("invalid key", () => {
              expect(execute("dict (a b c d) has []")).to.eql(
                ERROR("invalid key")
              );
              expect(execute("dict (a b c d) has ()")).to.eql(
                ERROR("invalid key")
              );
            });
          });
        });

        describe("`get`", () => {
          it("should return the value at the given key", () => {
            expect(evaluate("dict (a b c d) get a")).to.eql(STR("b"));
          });
          it("should return the default value for a non-existing key", () => {
            expect(evaluate("dict (a b c d) get e default")).to.eql(
              STR("default")
            );
          });
          it("should support key tuples", () => {
            expect(evaluate("dict (a b c d e f) get (a e)")).to.eql(
              evaluate("idem (b f)")
            );
          });
          specify("`get` <-> keyed selector equivalence", () => {
            rootScope.setNamedVariable(
              "v",
              MAP({
                a: STR("b"),
                c: STR("d"),
              })
            );
            evaluate("set d (dict $v)");

            expect(execute("dict $v get a")).to.eql(execute("idem $v(a)"));
            expect(execute("$d get a")).to.eql(execute("idem $v(a)"));
            expect(execute("idem $[$d](a)")).to.eql(execute("idem $v(a)"));

            expect(execute("dict $v get c")).to.eql(execute("idem $v(c)"));
            expect(execute("$d get c")).to.eql(execute("idem $v(c)"));
            expect(execute("idem $[$d](c)")).to.eql(execute("idem $v(c)"));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict (a b c d) get")).to.eql(
                ERROR('wrong # args: should be "dict value get key ?default?"')
              );
              expect(execute("dict (a b c d) get a b c")).to.eql(
                ERROR('wrong # args: should be "dict value get key ?default?"')
              );
            });
            specify("unknow key", () => {
              expect(execute("dict (a b c d) get e")).to.eql(
                ERROR('unknown key "e"')
              );
              expect(execute("dict (a b c d) get (a e)")).to.eql(
                ERROR('unknown key "e"')
              );
            });
            specify("invalid key", () => {
              expect(execute("dict (a b c d) get ([])")).to.eql(
                ERROR("invalid key")
              );
              expect(execute("dict (a b c d) get []")).to.eql(
                ERROR("invalid key")
              );
              expect(execute("dict (a b c d) get [list ()]")).to.eql(
                ERROR("invalid key")
              );
            });
            specify("key tuples with default", () => {
              expect(execute("dict (a b c d) get (a) default")).to.eql(
                ERROR("cannot use default with key tuples")
              );
            });
          });
        });

        describe("`keys`", () => {
          it("should return the list of keys", () => {
            expect(evaluate("dict (a b c d) keys")).to.eql(
              evaluate("list (a c)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict (a b c d) keys a")).to.eql(
                ERROR('wrong # args: should be "dict value keys"')
              );
            });
          });
        });

        describe("`values`", () => {
          it("should return the list of values", () => {
            expect(evaluate("dict (a b c d) values")).to.eql(
              evaluate("list (b d)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict (a b c d) values a")).to.eql(
                ERROR('wrong # args: should be "dict value values"')
              );
            });
          });
        });

        describe("`entries`", () => {
          it("should return the list of key-value tuples", () => {
            expect(evaluate("dict (a b c d) entries")).to.eql(
              evaluate("list ((a b) (c d))")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict (a b c d) entries a")).to.eql(
                ERROR('wrong # args: should be "dict value entries"')
              );
            });
          });
        });
      });

      mochadoc.section("Dictionary operations", () => {
        describe("`add`", () => {
          it("should add the value for a new key", () => {
            expect(evaluate("dict (a b c d) add e f")).to.eql(
              evaluate("dict (a b c d e f)")
            );
          });
          it("should replace the value for an existing key", () => {
            expect(evaluate("dict (a b c d) add a e")).to.eql(
              evaluate("dict (a e c d)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("dict (a b c d) add a")).to.eql(
                ERROR('wrong # args: should be "dict value add key value"')
              );
              expect(execute("dict (a b c d) add a b c")).to.eql(
                ERROR('wrong # args: should be "dict value add key value"')
              );
            });
            specify("invalid key", () => {
              expect(execute("dict (a b c d) add [] b")).to.eql(
                ERROR("invalid key")
              );
              expect(execute("dict (a b c d) add () b")).to.eql(
                ERROR("invalid key")
              );
            });
          });
        });

        describe("`remove`", () => {
          it("should remove the provided key", () => {
            expect(evaluate("dict (a b c d) remove a")).to.eql(
              evaluate("dict (c d)")
            );
          });
          it("should accept several keys to remove", () => {
            expect(evaluate("dict (a b c d e f) remove a e")).to.eql(
              evaluate("dict (c d)")
            );
          });
          it("should ignore unknown keys", () => {
            expect(evaluate("dict (a b c d e f) remove g")).to.eql(
              evaluate("dict (a b c d e f)")
            );
          });
          it("should accept zero key", () => {
            expect(evaluate("dict (a b c d e f) remove")).to.eql(
              evaluate("dict (a b c d e f)")
            );
          });

          describe("Exceptions", () => {
            specify("invalid key", () => {
              expect(execute("dict (a b c d) remove []")).to.eql(
                ERROR("invalid key")
              );
              expect(execute("dict (a b c d) remove ()")).to.eql(
                ERROR("invalid key")
              );
            });
          });
        });

        describe("`merge`", () => {
          it("should merge two maps", () => {
            expect(evaluate("dict (a b c d) merge (foo bar)")).to.eql(
              evaluate("dict (a b c d foo bar)")
            );
          });
          it("should accept several maps", () => {
            expect(
              evaluate("dict (a b c d) merge (foo bar) (baz sprong)")
            ).to.eql(evaluate("dict (a b c d foo bar baz sprong)"));
          });
          it("should accept zero map", () => {
            expect(evaluate("dict (a b c d) merge")).to.eql(
              evaluate("dict (a b c d)")
            );
          });

          describe("Exceptions", () => {
            specify("invalid values", () => {
              expect(execute("dict (a b c d) merge []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("dict (a b c d) merge [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("dict (a b c d) merge e")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("dict (a b c d) merge (e)")).to.eql(
                ERROR("invalid key-value list")
              );
            });
          });
        });
      });

      mochadoc.section("Iteration", () => {
        describe("`foreach`", () => {
          it("should iterate over entries", () => {
            evaluate(`
            set entries [list ()]
            set d [dict (a b c d e f)]
            dict $d foreach entry {
              set entries [list $entries append ($entry)]
            }
            `);
            expect(evaluate("get entries")).to.eql(evaluate("dict $d entries"));
          });
          describe("entry parameter tuples", () => {
            it("should be supported", () => {
              evaluate(`
            set keys [list ()]
            set values [list ()]
            set d [dict (a b c d e f)]
            dict $d foreach (key value) {
              set keys [list $keys append ($key)]
              set values [list $values append ($value)]
            }
            `);
              expect(evaluate("get keys")).to.eql(evaluate("dict $d keys"));
              expect(evaluate("get values")).to.eql(evaluate("dict $d values"));
            });
            it("should accept empty tuple", () => {
              evaluate(`
              set i 0
              dict (a b c d e f) foreach () {
                set i [+ $i 1]
              }
              `);
              expect(evaluate("get i")).to.eql(INT(3));
            });
            it("should accept (key) tuple", () => {
              evaluate(`
              set keys [list ()]
              set d [dict (a b c d e f)]
              dict (a b c d e f) foreach (key) {
                set keys [list $keys append ($key)]
              }
              `);
              expect(evaluate("get keys")).to.eql(evaluate("dict $d keys"));
            });
            it("should ignore extra elements", () => {
              expect(
                execute(`
                dict (a b c d e f) foreach (key value foo) {
                  if [exists foo] {unreachable}
                }
              `)
              ).to.eql(OK(NIL));
            });
          });
          it("should return the result of the last command", () => {
            expect(execute("dict () foreach entry {}")).to.eql(OK(NIL));
            expect(execute("dict (a b) foreach entry {}")).to.eql(OK(NIL));
            expect(
              evaluate(
                "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]}"
              )
            ).to.eql(INT(3));
          });

          describe("Control flow", () => {
            describe("`return`", () => {
              it("should interrupt the loop with `RETURN` code", () => {
                expect(
                  execute(
                    "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; return $entry; unreachable}"
                  )
                ).to.eql(execute("return (a b)"));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`tailcall`", () => {
              it("should interrupt the loop with `RETURN` code", () => {
                expect(
                  execute(
                    "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; tailcall {idem $entry}; unreachable}"
                  )
                ).to.eql(execute("return (a b)"));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`yield`", () => {
              it("should interrupt the body with `YIELD` code", () => {
                expect(
                  execute(
                    "dict (a b c d e f) foreach entry {yield; unreachable}"
                  ).code
                ).to.eql(ResultCode.YIELD);
              });
              it("should provide a resumable state", () => {
                const process = rootScope.prepareScript(
                  parse(
                    "dict (a b c d e f) foreach (key value) {idem _$[yield $key]_}"
                  )
                );

                let result = process.run();
                expect(result.code).to.eql(ResultCode.YIELD);
                expect(result.value).to.eql(STR("a"));
                expect(result.data).to.exist;

                process.yieldBack(STR("step 1"));
                result = process.run();
                expect(result.code).to.eql(ResultCode.YIELD);
                expect(result.value).to.eql(STR("c"));
                expect(result.data).to.exist;

                process.yieldBack(STR("step 2"));
                result = process.run();
                expect(result.code).to.eql(ResultCode.YIELD);
                expect(result.value).to.eql(STR("e"));
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
                    "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; error msg; unreachable}"
                  )
                ).to.eql(ERROR("msg"));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`break`", () => {
              it("should interrupt the body with nil result", () => {
                expect(
                  execute(
                    "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; break; unreachable}"
                  )
                ).to.eql(OK(NIL));
                expect(evaluate("get i")).to.eql(INT(1));
              });
            });
            describe("`continue`", () => {
              it("should interrupt the body iteration", () => {
                expect(
                  execute(
                    "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; continue; unreachable}"
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
              expect(execute("dict (a b c d) foreach a")).to.eql(
                ERROR('wrong # args: should be "dict value foreach entry body"')
              );
              expect(execute("dict (a b c d) foreach a b c")).to.eql(
                ERROR('wrong # args: should be "dict value foreach entry body"')
              );
            });
            specify("non-script body", () => {
              expect(execute("dict (a b c d) foreach a b")).to.eql(
                ERROR("body must be a script")
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("dict () unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("dict () []")).to.eql(
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
             * bundle the `dict` command and a value into a tuple to create a
             * pseudo-object value. For example:
             */
          },
          script: "set d (dict (a b c d))",
        },
        {
          doc: () => {
            /**
             * We can then use this variable like a regular command. Calling it
             * without argument will return the wrapped value:
             */
          },
          script: "$d",
          result: evaluate("dict (a b c d)"),
        },
        {
          doc: () => {
            /**
             * Subcommands then behave like object methods:
             */
          },
          script: "$d size",
          result: INT(2),
        },
        {
          script: "$d get a",
          result: STR("b"),
        },
        {
          script: "$d entries",
          result: evaluate("dict (a b c d) entries"),
        },
      ]);
      example("Argument type guard", [
        {
          doc: () => {
            /**
             * Calling `dict` with a single argument returns its value as a map.
             * This property allows `dict` to be used as a type guard for
             * argspecs.
             *
             * Here we create a macro `len` that returns twice the size of the
             * provided dictionary (accounting for key + value pairs). Using
             * `dict` as guard has three effects:
             *
             * - it validates the argument on the caller side
             * - it converts the value at most once
             * - it ensures type safety within the body
             *
             * Note how using `dict` as a guard for argument `d` makes it look
             * like a static type declaration:
             */
          },
          script: "macro len ( (dict d) ) {[dict $d size] * 2}",
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
          result: ERROR("invalid map"),
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

      it("should return its ensemble metacommand", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[dict]`.
         */
        expect(evaluate("dict").type).to.eql(commandValueType);
        expect(evaluate("dict")).to.be.instanceOf(EnsembleValue);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `dict` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [dict] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("dict (a b c d) foo")).to.eql(STR("bar"));
      });

      mochadoc.section("Examples", () => {
        example("Adding a `+` operator", [
          {
            doc: () => {
              /**
               * Here we create a `+` binary macro that merges two dictionaries
               * together:
               */
            },
            script: `
              [dict] eval {
                macro + {d1 d2} {dict $d1 merge $d2}
              }
            `,
          },
          {
            doc: () => {
              /**
               * (Note how we are free to name subcommand arguments however we
               * want)
               *
               * We can then use `+` as an infix merge operator:
               */
            },
            script: "dict (a b c d) + (a e f g)",
            result: evaluate("dict (a e c d f g)"),
          },
        ]);
      });
    });
  });

  mochadoc.section("`displayMapValue`", () => {
    mochadoc.summary("Display function for maps");

    it("should display maps as `dict` command + key-value tuple", () => {
      const map = MAP({
        a: STR("b"),
        c: STR("d"),
      });

      expect(displayMapValue(map)).to.eql("[dict (a b c d)]");
    });
    it("should produce an isomorphic string", () => {
      /**
       * Evaluating the string will produce an identical map value.
       */
      const map = MAP({
        a: STR("b"),
        c: STR("d"),
      });
      expect(evaluate(`idem ${displayMapValue(map)}`)).to.eql(map);
    });
  });
});
