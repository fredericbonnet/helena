import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, OK } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, TRUE, FALSE, INT, STR, TUPLE, StringValue } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { CommandValue, commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena argument handling", () => {
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

  describeCommand("argspec", () => {
    mochadoc.summary("Argspec handling");
    mochadoc.usage(usage("argspec"));
    mochadoc.description(() => {
      /**
       * The `argspec` command is a type command dedicated to argspec values
       * (short for _argument specification_). It provides an ensemble of
       * subcommands for argspec creation, conversion, access, and operations.
       *
       * Argspec values are custom Helena values.
       */
    });

    mochadoc.section("Argspec creation and conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `argspec`
         * will ensure a argspec value in return. This property means that
         * `argspec` can be used for creation and conversion, but also as a type
         * guard in argspecs.
         */
      });

      it("should return argspec value", () => {
        expect(evaluate("argspec ()")).to.be.instanceOf(ArgspecValue);
      });
      example("should convert blocks to argspecs", {
        doc: () => {
          /**
           * The most common syntax for argspec creation is to simply pass a
           * block of arguments; the block is evaluated in an empty scope and
           * each resulting word is added as an argspec argument in order.
           */
        },
        script: "argspec {a b c}",
        result: evaluate("argspec (a b c)"),
      });
      example("should convert tuples to argspecs", {
        doc: () => {
          /**
           * Tuples are also accepted.
           */
        },
        script: "argspec (a b c)",
      });
      example("should convert lists to argspecs", {
        doc: () => {
          /**
           * Lists are also accepted.
           */
        },
        script: "argspec [list {a b c}]",
        result: evaluate("argspec (a b c)"),
      });

      describe("Exceptions", () => {
        specify("invalid values", () => {
          /**
           * Only blocks, tuples, and lists are acceptable values.
           */
          expect(execute("argspec []")).to.eql(ERROR("invalid argument list"));
          expect(execute("argspec [1]")).to.eql(ERROR("invalid argument list"));
          expect(execute("argspec a")).to.eql(ERROR("invalid argument list"));
        });
        specify("blocks with side effects", () => {
          /**
           * Providing a block with side effects like substitutions or
           * expressions will result in an error.
           */
          expect(execute("argspec { $a }")).to.eql(
            ERROR("invalid argument list")
          );
          expect(execute("argspec { [b] }")).to.eql(
            ERROR("invalid argument list")
          );
          expect(execute("argspec { $[][a] }")).to.eql(
            ERROR("invalid argument list")
          );
          expect(execute("argspec { $[](a) }")).to.eql(
            ERROR("invalid argument list")
          );
        });
      });
    });

    mochadoc.section("Argument specifications", () => {
      describe("empty", () => {
        specify("value", () => {
          const value = evaluate("argspec ()") as ArgspecValue;
          expect(evaluate("argspec {}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 0,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.be.empty;
        });
        specify("usage", () => {
          expect(evaluate("argspec () usage")).to.eql(STR(""));
        });
        specify("set", () => {
          evaluate("argspec () set ()");
          expect(rootScope.context.variables).to.be.empty;
        });
      });

      describe("one parameter", () => {
        specify("value", () => {
          const value = evaluate("argspec (a)") as ArgspecValue;
          expect(evaluate("argspec {a}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 1,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([{ name: "a", type: "required" }]);
        });
        specify("usage", () => {
          expect(evaluate("argspec (a) usage")).to.eql(STR("a"));
        });
        specify("set", () => {
          evaluate("argspec (a) set (val1)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          evaluate("argspec (a) set (val2)");
          expect(evaluate("get a")).to.eql(STR("val2"));
        });
      });

      describe("two parameters", () => {
        specify("value", () => {
          const value = evaluate("argspec (a b)") as ArgspecValue;
          expect(evaluate("argspec {a b}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 2,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            { name: "a", type: "required" },
            { name: "b", type: "required" },
          ]);
        });
        specify("usage", () => {
          expect(evaluate("argspec (a b) usage")).to.eql(STR("a b"));
        });
        specify("set", () => {
          evaluate("argspec {a b} set (val1 val2)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(STR("val2"));
        });
      });

      describe("remainder", () => {
        describe("anonymous", () => {
          specify("value", () => {
            const value = evaluate("argspec (*)") as ArgspecValue;
            expect(evaluate("argspec {*}")).to.eql(value);
            expect(value.argspec).to.include({
              nbRequired: 0,
              nbOptional: 0,
              hasRemainder: true,
            });
            expect(value.argspec.args).to.eql([
              { name: "*", type: "remainder" },
            ]);
          });
          specify("usage", () => {
            expect(evaluate("argspec (*) usage")).to.eql(STR("?arg ...?"));
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("argspec (*) set ()");
              expect(evaluate("get *")).to.eql(TUPLE([]));
            });
            specify("one", () => {
              evaluate("argspec (*) set (val)");
              expect(evaluate("get *")).to.eql(TUPLE([STR("val")]));
            });
            specify("two", () => {
              evaluate("argspec (*) set (val1 val2)");
              expect(evaluate("get *")).to.eql(
                TUPLE([STR("val1"), STR("val2")])
              );
            });
          });
        });

        describe("named", () => {
          specify("value", () => {
            const value = evaluate("argspec (*args)") as ArgspecValue;
            expect(evaluate("argspec {*args}")).to.eql(value);
            expect(value.argspec).to.include({
              nbRequired: 0,
              nbOptional: 0,
              hasRemainder: true,
            });
            expect(value.argspec.args).to.eql([
              { name: "args", type: "remainder" },
            ]);
          });
          specify("usage", () => {
            expect(evaluate("argspec (*remainder) usage")).to.eql(
              STR("?remainder ...?")
            );
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("argspec (*args) set ()");
              expect(evaluate("get args")).to.eql(TUPLE([]));
            });
            specify("one", () => {
              evaluate("argspec (*args) set (val)");
              expect(evaluate("get args")).to.eql(TUPLE([STR("val")]));
            });
            specify("two", () => {
              evaluate("argspec (*args) set (val1 val2)");
              expect(evaluate("get args")).to.eql(
                TUPLE([STR("val1"), STR("val2")])
              );
            });
          });
        });

        describe("prefix", () => {
          specify("one", () => {
            evaluate("argspec (* a) set (val)");
            expect(evaluate("get *")).to.eql(TUPLE([]));
            expect(evaluate("get a")).to.eql(STR("val"));
          });
          specify("two", () => {
            evaluate("argspec (* a) set (val1 val2)");
            expect(evaluate("get *")).to.eql(TUPLE([STR("val1")]));
            expect(evaluate("get a")).to.eql(STR("val2"));
          });
          specify("three", () => {
            evaluate("argspec (* a) set (val1 val2 val3)");
            expect(evaluate("get *")).to.eql(TUPLE([STR("val1"), STR("val2")]));
            expect(evaluate("get a")).to.eql(STR("val3"));
          });
        });
        describe("infix", () => {
          specify("two", () => {
            evaluate("argspec (a * b) set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([]));
            expect(evaluate("get b")).to.eql(STR("val2"));
          });
          specify("three", () => {
            evaluate("argspec (a * b) set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2")]));
            expect(evaluate("get b")).to.eql(STR("val3"));
          });
          specify("four", () => {
            evaluate("argspec (a * b) set (val1 val2 val3 val4)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2"), STR("val3")]));
            expect(evaluate("get b")).to.eql(STR("val4"));
          });
        });
        describe("suffix", () => {
          specify("one", () => {
            evaluate("argspec (a *) set (val)");
            expect(evaluate("get *")).to.eql(TUPLE([]));
            expect(evaluate("get a")).to.eql(STR("val"));
            expect(evaluate("get *")).to.eql(TUPLE([]));
          });
          specify("two", () => {
            evaluate("argspec (a *) set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2")]));
          });
          specify("three", () => {
            evaluate("argspec (a *) set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2"), STR("val3")]));
          });
        });

        it("cannot be used more than once", () => {
          expect(execute("argspec (* *)")).to.eql(
            ERROR("only one remainder argument is allowed")
          );
          expect(execute("argspec (*a *b)")).to.eql(
            ERROR("only one remainder argument is allowed")
          );
        });
      });

      describe("optional parameter", () => {
        describe("single", () => {
          specify("value", () => {
            const value = evaluate("argspec (?a)") as ArgspecValue;
            expect(evaluate("argspec {?a}")).to.eql(value);
            expect(evaluate("argspec ((?a))")).to.eql(value);
            expect(evaluate("argspec {(?a)}")).to.eql(value);
            expect(evaluate("argspec ({?a})")).to.eql(value);
            expect(evaluate("argspec {{?a}}")).to.eql(value);
            expect(value.argspec).to.include({
              nbRequired: 0,
              nbOptional: 1,
              hasRemainder: false,
            });
            expect(value.argspec.args).to.eql([
              { name: "a", type: "optional" },
            ]);
          });
          specify("usage", () => {
            expect(evaluate("argspec (?a) usage")).to.eql(STR("?a?"));
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("argspec ?a set ()");
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
            });
            specify("one", () => {
              evaluate("argspec (?a) set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
            });
          });
        });
        describe("multiple", () => {
          specify("value", () => {
            const value = evaluate("argspec {?a ?b}") as ArgspecValue;
            expect(evaluate("argspec (?a ?b)")).to.eql(value);
            expect(value.argspec).to.include({
              nbRequired: 0,
              nbOptional: 2,
              hasRemainder: false,
            });
            expect(value.argspec.args).to.eql([
              { name: "a", type: "optional" },
              { name: "b", type: "optional" },
            ]);
          });
          specify("usage", () => {
            expect(evaluate("argspec (?a ?b) usage")).to.eql(STR("?a? ?b?"));
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("argspec (?a ?b) set ()");
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
              expect(execute("get b")).to.eql(
                ERROR(`cannot get "b": no such variable`)
              );
            });
            specify("one", () => {
              evaluate("argspec (?a ?b) set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
              expect(execute("get b")).to.eql(
                ERROR(`cannot get "b": no such variable`)
              );
            });
            specify("one two", () => {
              evaluate("argspec (?a ?b) set (val1 val2)");
              expect(evaluate("get a")).to.eql(STR("val1"));
              expect(evaluate("get b")).to.eql(STR("val2"));
            });
          });
        });

        describe("prefix", () => {
          specify("one", () => {
            evaluate("argspec (?a b) set (val)");
            expect(execute("get a")).to.eql(
              ERROR(`cannot get "a": no such variable`)
            );
            expect(evaluate("get b")).to.eql(STR("val"));
          });
          specify("two", () => {
            evaluate("argspec (?a b) set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
          });
        });
        describe("infix", () => {
          specify("two", () => {
            evaluate("argspec (a ?b c) set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(execute("get b")).to.eql(
              ERROR(`cannot get "b": no such variable`)
            );
            expect(evaluate("get c")).to.eql(STR("val2"));
          });
          specify("three", () => {
            evaluate("argspec (a ?b c) set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
            expect(evaluate("get c")).to.eql(STR("val3"));
          });
        });
        describe("suffix", () => {
          specify("one", () => {
            evaluate("argspec (a ?b) set (val)");
            expect(evaluate("get a")).to.eql(STR("val"));
            expect(execute("get b")).to.eql(
              ERROR(`cannot get "b": no such variable`)
            );
          });
          specify("two", () => {
            evaluate("argspec (a ?b) set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
          });
        });
      });

      describe("default parameter", () => {
        specify("value", () => {
          const value = evaluate("argspec ((?a val))") as ArgspecValue;
          expect(evaluate("argspec {(?a val)}")).to.eql(value);
          expect(evaluate("argspec ({?a val})")).to.eql(value);
          expect(evaluate("argspec {{?a val}}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 0,
            nbOptional: 1,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            { name: "a", type: "optional", default: STR("val") },
          ]);
        });
        specify("usage", () => {
          expect(evaluate("argspec ((?a def)) usage")).to.eql(STR("?a?"));
        });
        describe("set", () => {
          describe("static", () => {
            specify("zero", () => {
              evaluate("argspec ((?a def)) set ()");
              expect(evaluate("get a")).to.eql(STR("def"));
            });
            specify("one", () => {
              evaluate("argspec ((?a def)) set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
            });
          });
          describe("dynamic", () => {
            specify("zero", () => {
              evaluate("argspec ((?a {+ 1 2})) set ()");
              expect(evaluate("get a")).to.eql(INT(3));
            });
            specify("one", () => {
              evaluate("argspec ((?a def)) set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
            });
          });
        });
      });

      describe("guard", () => {
        specify("required parameter", () => {
          const value = evaluate("argspec ((list a))") as ArgspecValue;
          expect(value.argspec).to.include({
            nbRequired: 1,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            { name: "a", type: "required", guard: STR("list") },
          ]);
        });
        specify("optional parameter", () => {
          const value = evaluate("argspec ((list ?a))") as ArgspecValue;
          expect(value.argspec).to.include({
            nbRequired: 0,
            nbOptional: 1,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            { name: "a", type: "optional", guard: STR("list") },
          ]);
        });
        specify("default parameter", () => {
          const value = evaluate("argspec ((list ?a val))") as ArgspecValue;
          expect(value.argspec).to.include({
            nbRequired: 0,
            nbOptional: 1,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            {
              name: "a",
              type: "optional",
              guard: STR("list"),
              default: STR("val"),
            },
          ]);
        });
        specify("usage", () => {
          expect(evaluate("argspec ((guard ?a def)) usage")).to.eql(STR("?a?"));
        });
        describe("set", () => {
          describe("simple command", () => {
            specify("required", () => {
              evaluate("set args [argspec ( (list a) )]");
              expect(execute("argspec $args set ((1 2 3))")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list (1 2 3)"));
              expect(execute("argspec $args set (value)")).to.eql(
                ERROR("invalid list")
              );
            });
            specify("optional", () => {
              evaluate("set args [argspec ( (list ?a) )]");
              expect(execute("argspec $args set ()")).to.eql(OK(NIL));
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
              expect(execute("argspec $args set ((1 2 3))")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list (1 2 3)"));
              expect(execute("argspec $args set (value)")).to.eql(
                ERROR("invalid list")
              );
            });
            specify("default", () => {
              evaluate("set args [argspec ( (list ?a ()) )]");
              expect(execute("argspec $args set ()")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list ()"));
              expect(execute("argspec $args set ((1 2 3))")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list (1 2 3)"));
              expect(execute("argspec $args set (value)")).to.eql(
                ERROR("invalid list")
              );
            });
          });
          describe("tuple prefix", () => {
            specify("required", () => {
              evaluate("set args [argspec ( ((0 <) a) )]");
              expect(execute("argspec $args set (1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("argspec $args set (-1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(FALSE);
              expect(execute("argspec $args set (value)")).to.eql(
                ERROR('invalid number "value"')
              );
            });
            specify("optional", () => {
              evaluate("set args [argspec ( ((0 <) ?a) )]");
              expect(execute("argspec $args set ()")).to.eql(OK(NIL));
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
              expect(execute("argspec $args set (1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("argspec $args set (-1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(FALSE);
              expect(execute("argspec $args set (value)")).to.eql(
                ERROR('invalid number "value"')
              );
            });
            specify("default", () => {
              evaluate("set args [argspec ( ((0 <) ?a 1) )]");
              expect(execute("argspec $args set ()")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("argspec $args set (1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("argspec $args set (-1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(FALSE);
              expect(execute("argspec $args set (value)")).to.eql(
                ERROR('invalid number "value"')
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("empty argument name", () => {
          expect(execute('argspec ("")')).to.eql(ERROR("empty argument name"));
          expect(execute("argspec (?)")).to.eql(ERROR("empty argument name"));
          expect(execute('argspec ((""))')).to.eql(
            ERROR("empty argument name")
          );
          expect(execute("argspec ((?))")).to.eql(ERROR("empty argument name"));
        });
        specify("invalid argument name", () => {
          expect(execute("argspec ([])")).to.eql(
            ERROR("invalid argument name")
          );
          expect(execute("argspec (([]))")).to.eql(
            ERROR("invalid argument name")
          );
        });
        specify("duplicate arguments", () => {
          expect(execute("argspec (a a)")).to.eql(
            ERROR('duplicate argument "a"')
          );
          expect(execute("argspec ((?a def) a)")).to.eql(
            ERROR('duplicate argument "a"')
          );
          expect(execute("argspec (a (?a def))")).to.eql(
            ERROR('duplicate argument "a"')
          );
        });
        specify("empty argument specifier", () => {
          expect(execute("argspec (())")).to.eql(
            ERROR("empty argument specifier")
          );
          expect(execute("argspec ({})")).to.eql(
            ERROR("empty argument specifier")
          );
        });
        specify("too many specifiers", () => {
          expect(execute("argspec ((a b c d))")).to.eql(
            ERROR('too many specifiers for argument "a"')
          );
          expect(execute("argspec ({a b c d})")).to.eql(
            ERROR('too many specifiers for argument "a"')
          );
        });
        specify("non-optional parameter with guard and default", () => {
          expect(execute("argspec ((a b c))")).to.eql(
            ERROR('default argument "b" must be optional')
          );
          expect(execute("argspec ({a b c})")).to.eql(
            ERROR('default argument "b" must be optional')
          );
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `argspec` ensemble comes with a number of predefined subcommands
         * listed here.
         */
      });

      describe("`subcommands`", () => {
        mochadoc.description(usage("argspec () subcommands"));
        mochadoc.description(() => {
          /**
           * This subcommand is useful for introspection and interactive
           * calls.
           */
        });

        specify("usage", () => {
          expect(evaluate("help argspec () subcommands")).to.eql(
            STR("argspec value subcommands")
          );
        });

        it("should return argspec of subcommands", () => {
          expect(evaluate("argspec {} subcommands")).to.eql(
            evaluate("list (subcommands usage set)")
          );
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            expect(execute("argspec {} subcommands a")).to.eql(
              ERROR('wrong # args: should be "argspec value subcommands"')
            );
            expect(execute("help argspec {} subcommands a")).to.eql(
              ERROR('wrong # args: should be "argspec value subcommands"')
            );
          });
        });
      });

      describe("`usage`", () => {
        mochadoc.description(usage("argspec () usage"));
        mochadoc.description(() => {
          /**
           * Get a help string
           */
        });

        it("should return a usage string with argument names", () => {
          /**
           * This subcommand returns a help string for the argspec command.
           *
           */
          expect(evaluate("argspec {a b ?c *} usage")).to.eql(
            STR("a b ?c? ?arg ...?")
          );
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when given
             * the wrong number of arguments.
             */
            expect(execute("argspec {} usage a")).to.eql(
              ERROR('wrong # args: should be "argspec value usage"')
            );
          });
        });
      });

      describe("`set`", () => {
        mochadoc.description(usage("argspec () usage"));
        mochadoc.description(() => {
          /**
           * Set parameter variables from a list of argument values
           */
        });

        it("should return nil", () => {
          expect(evaluate("argspec {} set ()")).to.eql(NIL);
        });
        it("should set argument variables in the caller scope", () => {
          evaluate("argspec {a} set (val)");
          expect(evaluate("get a")).to.eql(STR("val"));
        });
        it("should enforce minimum number of arguments", () => {
          expect(execute("argspec {a} set ()")).to.eql(
            ERROR(`wrong # values: should be "a"`)
          );
          expect(execute("argspec {a ?b} set ()")).to.eql(
            ERROR(`wrong # values: should be "a ?b?"`)
          );
          expect(execute("argspec {?a b c} set (val)")).to.eql(
            ERROR(`wrong # values: should be "?a? b c"`)
          );
          expect(execute("argspec {a *b c} set (val)")).to.eql(
            ERROR(`wrong # values: should be "a ?b ...? c"`)
          );
        });
        it("should enforce maximum number of arguments", () => {
          expect(execute("argspec {} set (val1)")).to.eql(
            ERROR(`wrong # values: should be ""`)
          );
          expect(execute("argspec {a} set (val1 val2)")).to.eql(
            ERROR(`wrong # values: should be "a"`)
          );
          expect(execute("argspec {a ?b} set (val1 val2 val3)")).to.eql(
            ERROR(`wrong # values: should be "a ?b?"`)
          );
        });
        it("should set required attributes first", () => {
          evaluate("argspec {?a b ?c} set (val)");
          expect(evaluate("get b")).to.eql(STR("val"));
        });
        it("should skip missing optional attributes", () => {
          evaluate("argspec {?a b (?c def)} set (val)");
          expect(execute("get a")).to.eql(
            ERROR(`cannot get "a": no such variable`)
          );
          expect(evaluate("get b")).to.eql(STR("val"));
          expect(evaluate("get c")).to.eql(STR("def"));
        });
        it("should set optional attributes in order", () => {
          evaluate("argspec {(?a def) b ?c} set (val1 val2)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(STR("val2"));
          expect(execute("get c")).to.eql(
            ERROR(`cannot get "c": no such variable`)
          );
        });
        it("should set remainder after optional attributes", () => {
          evaluate("argspec {?a *b c} set (val1 val2)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(TUPLE([]));
          expect(evaluate("get c")).to.eql(STR("val2"));
        });
        it("should set all present attributes in order", () => {
          evaluate("argspec {?a *b c} set (val1 val2 val3 val4)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(TUPLE([STR("val2"), STR("val3")]));
          expect(evaluate("get c")).to.eql(STR("val4"));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when given
             * the wrong number of arguments.
             */
            expect(execute("argspec {} set")).to.eql(
              ERROR('wrong # args: should be "argspec value set values"')
            );
            expect(execute("argspec {} set a b")).to.eql(
              ERROR('wrong # args: should be "argspec value set values"')
            );
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("argspec () unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("argspec () []")).to.eql(
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
             * bundle the `argspec` command and a value into a tuple to create a
             * pseudo-object value. For example:
             */
          },
          script: "set l (argspec {a b ?c *})",
        },
        {
          doc: () => {
            /**
             * We can then use this variable like a regular command. Calling it
             * without argument will return the wrapped value:
             */
          },
          script: "$l",
          result: evaluate("argspec {a b ?c *}"),
        },
        {
          doc: () => {
            /**
             * Subcommands then behave like object methods:
             */
          },
          script: "$l usage",
          result: STR("a b ?c? ?arg ...?"),
        },
        {
          script: "$l set (val1 val2 val3); get (a b c)",
          result: TUPLE([STR("val1"), STR("val2"), STR("val3")]),
        },
      ]);
      example("Argument type guard", [
        {
          doc: () => {
            /**
             * Calling `argspec` with a single argument returns its value as a
             * argspec. This property allows `argspec` to be used as a type
             * guard for argspecs.
             *
             * Here we create a macro `usage` that returns the usage of the
             * provided argspec. Using `argspec` as guard has three effects:
             *
             * - it validates the argument on the caller side
             * - it converts the value at most once
             * - it ensures type safety within the body
             *
             * Note how using `argspec` as a guard for argument `a` makes it
             * look like a static type declaration:
             */
          },
          script: "macro usage ( (argspec a) ) {argspec $a usage}",
        },
        {
          doc: () => {
            /**
             * Passing a valid value will give the expected result:
             */
          },
          script: "usage {a b ?c *}",
          result: STR("a b ?c? ?arg ...?"),
        },
        {
          doc: () => {
            /**
             * Passing an invalid value will produce an error:
             */
          },
          script: "usage invalidValue",
          result: ERROR("invalid argument list"),
        },
      ]);
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `argspec` is an ensemble command, which means that it is a collection
         * of subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e.
         * `[argspec]`.
         */
        expect(evaluate("argspec").type).to.eql(commandValueType);
        expect(evaluate("argspec")).to.be.instanceOf(CommandValue);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `argspec` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [argspec] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("argspec (a b c) foo")).to.eql(STR("bar"));
      });
      it("should support help for custom subcommands", () => {
        /**
         * Like all ensemble commands, `argspec` have built-in support for
         * `help` on all subcommands that support it.
         */
        evaluate(`
          [argspec] eval {
            macro foo {value a b} {idem bar}
          }
        `);
        expect(evaluate("help argspec (a b c) foo")).to.eql(
          STR("argspec value foo a b")
        );
        expect(execute("help argspec (a b c) foo 1 2 3")).to.eql(
          ERROR('wrong # args: should be "argspec value foo a b"')
        );
      });

      mochadoc.section("Examples", () => {
        example("Adding a `help` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `help` alias to the existing `usage` within
               * the `argspec` ensemble, returning the `usage` with a prefix
               * string:
               */
            },
            script: `
              [argspec] eval {
                macro help {value prefix} {
                  idem "$prefix [argspec $value usage]"
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `help` just like the predefined `argspec`
               * subcommands:
               */
            },
            script: "argspec {a b ?c *} help foo",
            result: STR("foo a b ?c? ?arg ...?"),
          },
        ]);
      });
    });
  });
});
