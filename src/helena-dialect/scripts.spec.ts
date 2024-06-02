import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import {
  INT,
  LIST,
  ScriptValue,
  STR,
  StringValue,
  TUPLE,
  ValueType,
} from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena scripts", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const prepareScript = (script: string) =>
    rootScope.prepareProcess(rootScope.compile(parse(script)));
  const execute = (script: string) => prepareScript(script).run();
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

  describeCommand("parse", () => {
    mochadoc.summary("Helena script parsing");
    mochadoc.usage(usage("parse"));
    mochadoc.description(() => {
      /**
       * The `parse` command is used to parse script source strings into script
       * values.
       *
       * Script values are Helena values whose internal type is `SCRIPT`.
       */
    });

    mochadoc.section("Specifications", () => {
      it("should return a script value", () => {
        expect(evaluate('parse ""')).to.be.instanceOf(ScriptValue);
      });
      it("should return parsed script and source", () => {
        const source = "cmd arg1 arg2";
        const script = parse(source);
        expect(evaluate(`parse "${source}"`)).to.eql(
          new ScriptValue(script, source)
        );
      });
      it("should parse blocks as string values", () => {
        evaluate("set script {cmd arg1 arg2}");
        expect(evaluate(`parse $script`)).to.eql(evaluate("get script"));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The subcommand will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("parse")).to.eql(
          ERROR('wrong # args: should be "parse source"')
        );
        expect(execute("parse a b")).to.eql(
          ERROR('wrong # args: should be "parse source"')
        );
        expect(execute("help parse a b")).to.eql(
          ERROR('wrong # args: should be "parse source"')
        );
      });
      specify("parsing error", () => {
        expect(execute('parse "{"')).to.eql(ERROR("unmatched left brace"));
        expect(execute('parse ")"')).to.eql(
          ERROR("unmatched right parenthesis")
        );
        expect(execute('parse "#{"')).to.eql(
          ERROR("unmatched block comment delimiter")
        );
      });
      specify("values with no string representation", () => {
        expect(execute("parse []")).to.eql(
          ERROR("value has no string representation")
        );
        expect(execute("parse ()")).to.eql(
          ERROR("value has no string representation")
        );
      });
    });
  });

  describeCommand("script", () => {
    mochadoc.summary("Script handling");
    mochadoc.usage(usage("script"));
    mochadoc.description(() => {
      /**
       * The `script` command is a type command dedicated to script values. It
       * provides an ensemble of subcommands for script creation, conversion,
       * access, and operations.
       *
       * Script values are Helena values whose internal type is `SCRIPT`.
       */
    });

    mochadoc.section("Script creation and conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `script` will
         * ensure a script value in return. This property means that `script` can be
         * used for creation and conversion, but also as a type guard in argspecs.
         */
      });

      it("should return script value", () => {
        expect(evaluate("script {}")).to.be.instanceOf(ScriptValue);
      });
      it("should accept blocks", () => {
        expect(evaluate("script {}")).to.eql(new ScriptValue(parse(""), ""));
        expect(evaluate("script {a b c; d e}")).to.eql(
          new ScriptValue(parse("a b c; d e"), "a b c; d e")
        );
      });
      describe("tuples", () => {
        it("should be converted to scripts", () => {
          expect(evaluate("script ()")).to.be.instanceOf(ScriptValue);
        });
        specify("string value should be undefined", () => {
          expect((evaluate("script ()") as ScriptValue).source).to.be.undefined;
          expect((evaluate("script (a b)") as ScriptValue).source).to.be
            .undefined;
        });
        specify("empty tuples should return empty scripts", () => {
          const script = evaluate("script ()") as ScriptValue;
          expect(script.script.sentences).to.be.empty;
        });
        it("non-empty tuples should return single-sentence scripts", () => {
          const script = evaluate(
            "script (cmd (a) ; ; #{comment}# [1])"
          ) as ScriptValue;
          expect(script.script.sentences).to.have.lengthOf(1);
          expect(script.script.sentences[0].words).to.eql([
            STR("cmd"),
            TUPLE([STR("a")]),
            INT(1),
          ]);
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `script` ensemble comes with a number of predefined subcommands
         * listed here.
         */
      });

      mochadoc.section("Introspection", () => {
        describe("`subcommands`", () => {
          mochadoc.description(usage("script {} subcommands"));
          mochadoc.description(() => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
          });

          specify("usage", () => {
            expect(evaluate("help script {} subcommands")).to.eql(
              STR("script value subcommands")
            );
          });

          it("should return list of subcommands", () => {
            expect(evaluate("script {} subcommands")).to.eql(
              evaluate("list (subcommands length append split)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("script {} subcommands a")).to.eql(
                ERROR('wrong # args: should be "script value subcommands"')
              );
              expect(execute("help script {} subcommands a")).to.eql(
                ERROR('wrong # args: should be "script value subcommands"')
              );
            });
          });
        });
      });

      mochadoc.section("Accessors", () => {
        describe("`length`", () => {
          mochadoc.summary("Get script length");
          mochadoc.description(usage("script {} length"));

          it("should return the number of sentences", () => {
            expect(evaluate("script {} length")).to.eql(INT(0));
            expect(evaluate("script {a b; c d;; ;} length")).to.eql(INT(2));
            expect(evaluate("script () length")).to.eql(INT(0));
            expect(evaluate("script (a b; c d;; ;) length")).to.eql(INT(1));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("script () length a")).to.eql(
                ERROR('wrong # args: should be "script value length"')
              );
              expect(execute("help script () length a")).to.eql(
                ERROR('wrong # args: should be "script value length"')
              );
            });
          });
        });
      });

      mochadoc.section("Operations", () => {
        describe("`append`", () => {
          mochadoc.summary("Concatenate scripts");
          mochadoc.description(usage("script {} append"));

          specify("usage", () => {
            expect(evaluate("help script {} append")).to.eql(
              STR("script value append ?script ...?")
            );
          });

          it("should append two scripts", () => {
            expect(evaluate("script {a b c} append {foo bar}")).to.eql(
              new ScriptValue(parse("a b c; foo bar"), undefined)
            );
          });
          it("should accept several scripts", () => {
            expect(
              evaluate(
                "script {a b; c ; d e} append {f g} {h i; j k l} {m n; o}"
              )
            ).to.eql(
              new ScriptValue(
                parse("a b; c; d e; f g; h i; j k l; m n; o"),
                undefined
              )
            );
          });
          it("should accept both scripts and tuples scripts", () => {
            expect(
              (
                evaluate(
                  "script {a b; c ; d e} append (f g) {h i; j k l} (m n; o)"
                ) as ScriptValue
              ).script.sentences
            ).to.have.lengthOf(7);
          });
          it("should accept zero scripts", () => {
            expect(evaluate("script {a b c} append")).to.eql(
              evaluate("script {a b c}")
            );
          });

          describe("Exceptions", () => {
            specify("invalid values", () => {
              expect(execute("script {} append []")).to.eql(
                ERROR("value must be a script or tuple")
              );
              expect(execute("script {} append a")).to.eql(
                ERROR("value must be a script or tuple")
              );
              expect(execute("script {} append a [1]")).to.eql(
                ERROR("value must be a script or tuple")
              );
            });
          });
        });

        describe("`split`", () => {
          mochadoc.summary("Split scripts into sentences");
          mochadoc.description(usage("script {} split"));

          specify("usage", () => {
            expect(evaluate("help script {} split")).to.eql(
              STR("script value split")
            );
          });

          it("should split script sentences into list of scripts", () => {
            expect(evaluate("script {} split")).to.eql(evaluate("list {}"));
            expect(evaluate("script {a b; c d;; ;} split")).to.eql(
              LIST([
                new ScriptValue(parse("a b"), undefined),
                new ScriptValue(parse("c d"), undefined),
              ])
            );
            expect(evaluate("script () split")).to.eql(LIST([]));
            expect(evaluate("script (a b; c d;; ;) split")).to.eql(
              evaluate("list ([script (a b c d)])")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("script () split a")).to.eql(
                ERROR('wrong # args: should be "script value split"')
              );
              expect(execute("help script () split a")).to.eql(
                ERROR('wrong # args: should be "script value split"')
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("script {} unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("script {} []")).to.eql(
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
             * bundle the `script` command and a value into a tuple to create a
             * pseudo-object value. For example:
             */
          },
          script: "set s (script {a b c; d e; f})",
        },
        {
          doc: () => {
            /**
             * We can then use this variable like a regular command. Calling it
             * without argument will return the wrapped value:
             */
          },
          script: "$s",
          result: evaluate("script {a b c; d e; f}"),
        },
        {
          doc: () => {
            /**
             * Subcommands then behave like object methods:
             */
          },
          script: "$s length",
          result: INT(3),
        },
      ]);
      example("Argument type guard", [
        {
          doc: () => {
            /**
             * Calling `script` with a single argument returns its value as a
             * script. This property allows `script` to be used as a type guard
             * for argspecs.
             *
             * Here we create a macro `len` that returns the length of the
             * provided script. Using `script` as guard has three effects:
             *
             * - it validates the argument on the caller side
             * - it converts the value at most once
             * - it ensures type safety within the body
             *
             * Note how using `script` as a guard for argument `s` makes it look
             * like a static type declaration:
             */
          },
          script: "macro len ( (script s) ) {script $s length}",
        },
        {
          doc: () => {
            /**
             * Passing a valid value will give the expected result:
             */
          },
          script: "len {a b c; d e; f}",
          result: INT(3),
        },
        {
          doc: () => {
            /**
             * Passing an invalid value will produce an error:
             */
          },
          script: "len invalidValue",
          result: ERROR("value must be a script or tuple"),
        },
      ]);
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `script` is an ensemble command, which means that it is a collection
         * of subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[script]`.
         */
        expect(evaluate("script").type).to.eql(ValueType.COMMAND);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `script` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [script] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("script {} foo")).to.eql(STR("bar"));
      });
      it("should support help for custom subcommands", () => {
        /**
         * Like all ensemble commands, `script` have built-in support for `help`
         * on all subcommands that support it.
         */
        evaluate(`
          [script] eval {
            macro foo {value a b} {idem bar}
          }
        `);
        expect(evaluate("help script {} foo")).to.eql(
          STR("script value foo a b")
        );
        expect(execute("help script {} foo 1 2 3")).to.eql(
          ERROR('wrong # args: should be "script value foo a b"')
        );
      });

      mochadoc.section("Examples", () => {
        example("Adding a `last` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `last` macro within the `script` ensemble scope,
               * returning the last sentence of the provided script value:
               */
            },
            script: `
              [script] eval {
                macro last {value} {
                  list [script $value split] at [- [script $value length] 1]
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `last` just like the predefined `script`
               * subcommands:
               */
            },
            script: `
              set s [script {error a; return b; idem c} last]
              eval $s
            `,
            result: STR("c"),
          },
        ]);
      });
    });
  });
});
