import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, OK } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import {
  NIL,
  TRUE,
  FALSE,
  INT,
  STR,
  TUPLE,
  StringValue,
  ValueType,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { Scope } from "./core";
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
              evaluate("argspec (?a) set ()");
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
            specify("two", () => {
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
              evaluate("argspec ((?a {unreachable})) set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
            });
            specify("unexpected result", () => {
              /**
               * Dynamic defaults should return `OK` codes.
               */
              expect(execute("argspec ((?a {return})) set ()")).to.eql(
                ERROR("unexpected return")
              );
              expect(execute("argspec ((?a {yield})) set ()")).to.eql(
                ERROR("unexpected yield")
              );
              expect(execute("argspec ((?a {error msg})) set ()")).to.eql(
                ERROR("msg")
              );
              expect(execute("argspec ((?a {break})) set ()")).to.eql(
                ERROR("unexpected break")
              );
              expect(execute("argspec ((?a {continue})) set ()")).to.eql(
                ERROR("unexpected continue")
              );
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

          describe("Exceptions", () => {
            specify("unexpected result", () => {
              /**
               * Guards should return either `OK` or `ERROR` codes.
               */
              expect(execute("argspec ( (eval a) ) set ({return})")).to.eql(
                ERROR("unexpected return")
              );
              expect(execute("argspec ( (eval a) ) set ({yield})")).to.eql(
                ERROR("unexpected yield")
              );
              expect(execute("argspec ( (eval a) ) set ({break})")).to.eql(
                ERROR("unexpected break")
              );
              expect(execute("argspec ( (eval a) ) set ({continue})")).to.eql(
                ERROR("unexpected continue")
              );
            });
            specify("wrong arity", () => {
              /**
               * Guards should take a single argument.
               */
              evaluate("macro guard0 {} {}");
              evaluate("macro guard2 {a b} {}");
              expect(execute("argspec ( (guard0 a) ) set (val)")).to.eql(
                ERROR('wrong # args: should be "guard0"')
              );
              expect(execute("argspec ( (guard2 a) ) set (val)")).to.eql(
                ERROR('wrong # args: should be "guard2 a b"')
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

    mochadoc.section("Option specifications", () => {
      mochadoc.description(() => {
        /**
         * Arguments can be preceded by an option specification. Option names
         * start with a dash character `-`.
         */
      });

      describe("Required options", () => {
        specify("value", () => {
          const value = evaluate("argspec (-o a)") as ArgspecValue;
          expect(evaluate("argspec {-o a}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 2,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            {
              name: "a",
              type: "required",
              option: { names: ["-o"], type: "option" },
            },
          ]);
        });
        specify("usage", () => {
          expect(evaluate("argspec (-o a) usage")).to.eql(STR("-o a"));
          expect(evaluate("argspec ((-o --opt) a) usage")).to.eql(
            STR("-o|--opt a")
          );
        });
        describe("set", () => {
          specify("one", () => {
            evaluate("argspec (-o a) set (-o val)");
            expect(evaluate("get a")).to.eql(STR("val"));
          });
          specify("two", () => {
            evaluate("argspec (-o a -p b) set (-o val1 -p val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
          });
          specify("out of order", () => {
            evaluate("argspec (-o a -p b) set (-p val1 -o val2)");
            expect(evaluate("get a")).to.eql(STR("val2"));
            expect(evaluate("get b")).to.eql(STR("val1"));
          });
          specify("prefix", () => {
            evaluate("argspec (-o a -p b c) set (-o val1 -p val2 val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
            expect(evaluate("get c")).to.eql(STR("val3"));
          });
          specify("suffix", () => {
            evaluate("argspec (a -o b -p c) set (val1 -o val2 -p val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
            expect(evaluate("get c")).to.eql(STR("val3"));
          });
          specify("infix", () => {
            evaluate("argspec (a -o b -p c d) set (val1 -o val2 -p val3 val4)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
            expect(evaluate("get c")).to.eql(STR("val3"));
            expect(evaluate("get d")).to.eql(STR("val4"));
          });
          specify("complex case", () => {
            evaluate(`argspec (
                a 
                -o1 b -o2 c 
                d 
                -o3 e
                f g h 
                -o4 i -o5 j -o6 k
                l
              ) set (
                val1 
                -o2 val2 -o1 val3
                val4 
                -o3 val5 
                val6 val7 val8
                -o6 val9 -o4 val10 -o5 val11
                val12
              )`);
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val3"));
            expect(evaluate("get c")).to.eql(STR("val2"));
            expect(evaluate("get d")).to.eql(STR("val4"));
            expect(evaluate("get e")).to.eql(STR("val5"));
            expect(evaluate("get f")).to.eql(STR("val6"));
            expect(evaluate("get g")).to.eql(STR("val7"));
            expect(evaluate("get h")).to.eql(STR("val8"));
            expect(evaluate("get i")).to.eql(STR("val10"));
            expect(evaluate("get j")).to.eql(STR("val11"));
            expect(evaluate("get k")).to.eql(STR("val9"));
            expect(evaluate("get l")).to.eql(STR("val12"));
          });
        });
      });

      describe("Optional options", () => {
        specify("value", () => {
          const value = evaluate("argspec (-o ?a)") as ArgspecValue;
          expect(evaluate("argspec {-o ?a}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 0,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            {
              name: "a",
              type: "optional",
              option: { names: ["-o"], type: "option" },
            },
          ]);
        });
        specify("usage", () => {
          expect(evaluate("argspec (-o ?a) usage")).to.eql(STR("?-o a?"));
          expect(evaluate("argspec ((-o --opt) ?a) usage")).to.eql(
            STR("?-o|--opt a?")
          );
        });
        describe("set", () => {
          specify("zero", () => {
            evaluate("argspec (-o ?a) set ()");
            expect(execute("get a")).to.eql(
              ERROR(`cannot get "a": no such variable`)
            );
          });
          specify("default", () => {
            evaluate("argspec (-o (?a def)) set ()");
            expect(evaluate("get a")).to.eql(STR("def"));
          });
          specify("one", () => {
            evaluate("argspec (-o ?a) set (-o val)");
            expect(evaluate("get a")).to.eql(STR("val"));
          });
          specify("two", () => {
            evaluate("argspec (-o ?a -p ?b) set (-o val)");
            expect(evaluate("get a")).to.eql(STR("val"));
            expect(execute("get b")).to.eql(
              ERROR(`cannot get "b": no such variable`)
            );
          });
        });
      });

      describe("Flags", () => {
        mochadoc.description(() => {
          /**
           * Flags are optional boolean options that take no value.
           */
        });

        specify("value", () => {
          const value = evaluate("argspec (?-o ?a)") as ArgspecValue;
          expect(evaluate("argspec {?-o ?a}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 0,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([
            {
              name: "a",
              type: "optional",
              option: { names: ["-o"], type: "flag" },
            },
          ]);
        });
        specify("usage", () => {
          expect(evaluate("argspec (?-o ?a) usage")).to.eql(STR("?-o?"));
          expect(evaluate("argspec ((?-o ?--opt) ?a) usage")).to.eql(
            STR("?-o|--opt?")
          );
        });
        describe("set", () => {
          specify("zero", () => {
            evaluate("argspec (?-o ?a) set ()");
            expect(evaluate("get a")).to.eql(FALSE);
          });
          specify("one", () => {
            evaluate("argspec (?-o ?a) set (-o)");
            expect(evaluate("get a")).to.eql(TRUE);
          });
          specify("two", () => {
            evaluate("argspec (?-o ?a ?-p ?b) set (-p)");
            expect(evaluate("get a")).to.eql(FALSE);
            expect(evaluate("get b")).to.eql(TRUE);
          });
        });

        describe("Exceptions", () => {
          specify("non-optional argument", () => {
            /**
             * Flag arguments must be optional
             */
            expect(execute("argspec (?-o a)")).to.eql(
              ERROR(`argument for flag "-o" must be optional`)
            );
          });
        });
      });

      describe("Exceptions", () => {
        specify("missing argument", () => {
          /**
           * Options must be followed by an argument.
           */
          expect(execute("argspec (-a)")).to.eql(
            ERROR(`missing argument for option "-a"`)
          );
          expect(execute("argspec ((-a --argument))")).to.eql(
            ERROR(`missing argument for option "-a|--argument"`)
          );
          expect(execute("argspec ({-a --arg --argument-name})")).to.eql(
            ERROR(`missing argument for option "-a|--arg|--argument-name"`)
          );
          expect(execute("argspec ([list (-a --argument)])")).to.eql(
            ERROR(`missing argument for option "-a|--argument"`)
          );
        });
        specify("incompatible aliases", () => {
          expect(execute("argspec ((?-a --argument) a)")).to.eql(
            ERROR(`incompatible aliases for option "-a"`)
          );
          expect(execute("argspec ((-a ?--argument) a)")).to.eql(
            ERROR(`incompatible aliases for option "-a"`)
          );
        });
        specify("duplicate options", () => {
          expect(execute("argspec (-o a -o b)")).to.eql(
            ERROR('duplicate option "-o"')
          );
          expect(execute("argspec ((-o --opt) a --opt b)")).to.eql(
            ERROR('duplicate option "--opt"')
          );
          expect(execute("argspec ((-o -o) a --opt b)")).to.eql(
            ERROR('duplicate option "-o"')
          );
        });
        specify("remainder before options", () => {
          expect(execute("argspec (*args -o o)")).to.eql(
            ERROR("cannot use remainder argument before options")
          );
          expect(execute("argspec (*args -o ?o)")).to.eql(
            ERROR("cannot use remainder argument before options")
          );
          expect(execute("argspec (*args ?-o ?o)")).to.eql(
            ERROR("cannot use remainder argument before options")
          );
        });
        specify("option terminator", () => {
          expect(execute("argspec (--)")).to.eql(
            ERROR(`cannot use option terminator as option name`)
          );
          expect(execute("argspec (?--)")).to.eql(
            ERROR(`cannot use option terminator as option name`)
          );
          expect(execute("argspec ((-a --))")).to.eql(
            ERROR(`cannot use option terminator as option name`)
          );
        });
      });
    });

    mochadoc.section("Evaluation order", () => {
      mochadoc.description(() => {
        /**
         * Argument values are evaluated left-to-right and in order of priority:
         *
         * - Required arguments
         * - Optional arguments
         * - Remainder
         *
         * If there are neither optional nor remainder arguments then the number
         * of provided argument values must match the number of required
         * arguments. Else it must be at least equal to the number of required
         * arguments.
         *
         * If there is no remainder argument then the number of extra argument
         * values must not exceed the number of optional arguments. Else the
         * the remainder argument is set to the remaining values.
         *
         * Consecutive arguments are grouped depending on whether they have an
         * option specification. There can be any number of groups of alternate
         * kinds.
         *
         * Opionless arguments are positional and must be provided in the same
         * order as they are specified.
         *
         * Options can be provided in any order within the same group of
         * consecutive options.
         *
         * In both cases, optional argument values are set in the order they are
         * provided.
         */
      });

      specify("required positionals only", () => {
        /**
         * The number of values must match the number of required arguments.
         * Values are provided in order.
         */
        evaluate("set s [argspec (a b c)]");
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(`wrong # values: should be "a b c"`)
        );
        expect(execute("argspec $s set (1 2 3 4)")).to.eql(
          ERROR(`wrong # values: should be "a b c"`)
        );
        expect(evaluate("argspec $s set (1 2 3); get (a b c)")).to.eql(
          evaluate("idem (1 2 3)")
        );
      });
      specify("required options only", () => {
        /**
         * The number of values must match the number of required options.
         * Values can be provided out-of-order.
         */
        evaluate("set s [argspec (-a a -b b -c c)]");
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(`wrong # values: should be "-a a -b b -c c"`)
        );
        expect(execute("argspec $s set (-a 1)")).to.eql(
          ERROR(`wrong # values: should be "-a a -b b -c c"`)
        );
        expect(execute("argspec $s set (-a 1 -b 2 -c 3 4)")).to.eql(
          ERROR("extra values after arguments")
        );
        expect(evaluate("argspec $s set (-a 1 -b 2 -c 3); get (a b c)")).to.eql(
          evaluate("idem (1 2 3)")
        );
        expect(evaluate("argspec $s set (-b 1 -c 2 -a 3); get (a b c)")).to.eql(
          evaluate("idem (3 1 2)")
        );
      });
      specify("required and optional options", () => {
        /**
         * The number of values must be at least the number of required options,
         * and at most the total number of options. Values can be provided
         * out-of-order. All required options must be provided.
         */
        evaluate("set s [argspec (-a a -b ?b ?-c ?c -d ?d -e e)]");
        evaluate(
          "macro cleanup {} {list (a b c d e) foreach v {catch {unset $v}}}"
        );
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(`wrong # values: should be "-a a ?-b b? ?-c? ?-d d? -e e"`)
        );
        expect(execute("argspec $s set (-a 1)")).to.eql(
          ERROR(`wrong # values: should be "-a a ?-b b? ?-c? ?-d d? -e e"`)
        );
        expect(execute("argspec $s set (-a 1 -b 2 -c -d 3 -e 4 5)")).to.eql(
          ERROR("extra values after arguments")
        );
        expect(
          evaluate("argspec $s set (-a 1 -b 2 -c -d 3 -e 4); get (a b c d e)")
        ).to.eql(evaluate("idem (1 2 [true] 3 4)"));
        expect(
          evaluate(
            "cleanup; argspec $s set (-a 1 -e 2); list ($a [exists b] $c [exists d] $e)"
          )
        ).to.eql(evaluate("list (1 [false] [false] [false] 2)"));
        expect(execute("argspec $s set (-b 1 -d 2)")).to.eql(
          ERROR(`missing value for option "-a"`)
        );
        expect(execute("argspec $s set (-b 1 -a 2 -d 3)")).to.eql(
          ERROR(`missing value for option "-e"`)
        );
        expect(execute("argspec $s set (-c -a 1 -d 2)")).to.eql(
          ERROR(`missing value for option "-e"`)
        );
      });
      specify("required positional and option groups", () => {
        /**
         * The number of values must match the number of required options.
         * Within the same group, positional values are provided in order
         * whereas options can be provided out-of-order. Options cannot be
         * provided outside of their group.
         */
        evaluate("set s [argspec (a b -c c d -e e -f f -g g h i j -k k)]");
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(
            `wrong # values: should be "a b -c c d -e e -f f -g g h i j -k k"`
          )
        );
        expect(execute("argspec $s set (a b -c)")).to.eql(
          ERROR(
            `wrong # values: should be "a b -c c d -e e -f f -g g h i j -k k"`
          )
        );
        expect(
          evaluate(
            "argspec $s set (1 2 -c 3 4 -e 5 -f 6 -g 7 8 9 10 -k 11); get (a b c d e f g h i j k)"
          )
        ).to.eql(evaluate("idem (1 2 3 4 5 6 7 8 9 10 11)"));
        expect(
          evaluate(
            "argspec $s set (1 2 -c 3 4 -e 5 -g 6 -f 7 8 9 10 -k 11); get (a b c d e f g h i j k)"
          )
        ).to.eql(evaluate("idem (1 2 3 4 5 7 6 8 9 10 11)"));
        expect(
          execute("argspec $s set (1 2 -e 3 4 -c 5 -f 6 -g 7 8 9 10 -k 11)")
        ).to.eql(ERROR(`unexpected option "-e"`));
        expect(
          execute("argspec $s set (1 2 -c 3 4 -e 5 -f 6 -f 7 8 9 10 -k 11)")
        ).to.eql(ERROR(`duplicate values for option "-f"`));
      });
      specify("optional arguments", () => {
        /**
         * Optional argument values are set left-to-right:
         * - Positionals are set in the order they are specified
         * - Options can be set in any order and can be omitted
         */
        evaluate("set s [argspec (?a ?b ?-c ?c -d ?d ?e ?f)]");
        evaluate(
          "macro cleanup {} {list (a b c d e f) foreach v {catch {unset $v}}}"
        );
        expect(
          evaluate(
            "argspec $s set (); list ([exists a] [exists b] $c [exists d] [exists e] [exists f])"
          )
        ).to.eql(
          evaluate("list ([false] [false] [false] [false] [false] [false])")
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (1); list ($a [exists b] $c [exists d] [exists e] [exists f])"
          )
        ).to.eql(evaluate("list (1 [false] [false] [false] [false] [false])"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2); list ($a $b $c [exists d] [exists e] [exists f])"
          )
        ).to.eql(evaluate("list (1 2 [false] [false] [false] [false])"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 3); list ($a $b $c [exists d] $e [exists f])"
          )
        ).to.eql(evaluate("list (1 2 [false] [false] 3 [false])"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 3 4); list ($a $b $c [exists d] $e $f)"
          )
        ).to.eql(evaluate("list (1 2 [false] [false] 3 4)"));
        expect(execute("argspec $s set (1 2 3 4 5)")).to.eql(
          ERROR("extra values after arguments")
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -c 3 4); list ($a $b $c [exists d] $e $f)"
          )
        ).to.eql(evaluate("list (1 2 [true] [false] 3 4)"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -d 3 4); list ($a $b $c $d $e [exists f])"
          )
        ).to.eql(evaluate("list (1 2 [false] 3 4 [false])"));
        expect(execute("argspec $s set (1 -d 2 3 4)")).to.eql(
          ERROR("extra values after arguments")
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -c -d 3 4); list ($a $b $c $d $e [exists f])"
          )
        ).to.eql(evaluate("list (1 2 [true] 3 4 [false])"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -c -d 3 4 5); list ($a $b $c $d $e $f)"
          )
        ).to.eql(evaluate("list (1 2 [true] 3 4 5)"));
      });
      specify("remainder argument", () => {
        /**
         * Remainder argument values are always set after all required and
         * optional arguments have been set. This can bring unexpected results.
         */
        evaluate("set s [argspec (?a ?-b ?b -c ?c -d d *args e)]");
        evaluate(
          "macro cleanup {} {list (a b c d e args) foreach v {catch {unset $v}}}"
        );
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(`wrong # values: should be "?a? ?-b? ?-c c? -d d ?args ...? e"`)
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (-d 1 2); list ([exists a] $b [exists c] $d $e $args)"
          )
        ).to.eql(evaluate("list ([false] [false] [false] 1 2 ())"));
        expect(execute("argspec $s set (-d 1 2 3)")).to.eql(
          ERROR(`unknown option "1"`)
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (1 -d 2 3 4); list ($a $b [exists c] $d $e $args)"
          )
        ).to.eql(evaluate("list (1 [false] [false] 2 4 (3))"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 -b -d 2 3); list ($a $b [exists c] $d $e $args)"
          )
        ).to.eql(evaluate("list (1 [true] [false] 2 3 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 -b -d 2 3 4); list ($a $b [exists c] $d $e $args)"
          )
        ).to.eql(evaluate("list (1 [true] [false] 2 4 (3))"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 -b -c 2 -d 3 4); list ($a $b $c $d $e $args)"
          )
        ).to.eql(evaluate("list (1 [true] 2 3 4 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 -b -c 2 -d 3 4 5 6); list ($a $b $c $d $e $args)"
          )
        ).to.eql(evaluate("list (1 [true] 2 3 6 (4 5))"));
      });
      specify("option terminator", () => {
        /**
         * Option terminators `--` will end option groups as long as all
         * required options have been set. They are ignored when checking arity.
         */
        evaluate("set s [argspec (-a a -b b c -d ?d ?-e ?e *args)]");
        evaluate(
          "macro cleanup {} {list (a b c d e args) foreach v {catch {unset $v}}}"
        );
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(
            `wrong # values: should be "-a a -b b c ?-d d? ?-e? ?args ...?"`
          )
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (-a 1 -b 2 3 -d 4 -e); get (a b c d e args)"
          )
        ).to.eql(evaluate("idem (1 2 3 4 [true] ())"));
        expect(execute("argspec $s set (-- -a 1 -b 2 3 -d 4 -e)")).to.eql(
          ERROR("unexpected option terminator")
        );
        expect(execute("argspec $s set (-a 1 -- -b 2 3 -d 4 -e)")).to.eql(
          ERROR("unexpected option terminator")
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (-a 1 -b 2 -- 3 -d 4 -e); get (a b c d e args)"
          )
        ).to.eql(evaluate("idem (1 2 3 4 [true] ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (-a 1 -b 2 3 -- 4 5 6); list ($a $b $c [exists d] $e $args)"
          )
        ).to.eql(evaluate("list (1 2 3 [false] [false] (4 5 6))"));
        expect(
          evaluate(
            "cleanup; argspec $s set (-a 1 -b 2 3 -d 4 -e --); get (a b c d e args)"
          )
        ).to.eql(evaluate("idem (1 2 3 4 [true] ())"));
      });
      specify("complex case", () => {
        evaluate(
          "set s [argspec (a ?b ?-c ?c -d ?d -e e -f ?f -g g ?h *args ?i j k)]"
        );
        evaluate(
          "macro cleanup {} {list (a b c d e f g h i j k args) foreach v {catch {unset $v}}}"
        );
        expect(execute("argspec $s set ()")).to.eql(
          ERROR(
            `wrong # values: should be "a ?b? ?-c? ?-d d? -e e ?-f f? -g g ?h? ?args ...? ?i? j k"`
          )
        );
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -c -d 3 -e 4 -f 5 -g 6 7 8 9 10 11 12 13); get (a b c d e f g h i j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [true] 3 4 5 6 7 11 12 13 (8 9 10))"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 -e 2 -g 3 4 5); get (a c e g j k args)"
          )
        ).to.eql(evaluate("idem (1 [false] 2 3 4 5 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -e 3 -g 4 5 6); get (a b c e g j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [false] 3 4 5 6 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -e 3 -g 4 5 6); get (a b c e g j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [false] 3 4 5 6 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -c -e 3 -g 4 5 6); get (a b c e g j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [true] 3 4 5 6 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -d 3 -e 4 -g 5 6 7); get (a b c d e g j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [false] 3 4 5 6 7 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -d 3 -e 4 -g 5 6 7 8); get (a b c d e g h j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [false] 3 4 5 6 7 8 ())"));
        expect(
          evaluate(
            "cleanup; argspec $s set (1 2 -d 3 -e 4 -g 5 6 7 8 9); get (a b c d e g h i j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [false] 3 4 5 6 7 8 9 ())"));
        expect(
          evaluate(
            "argspec $s set (1 2 -d 3 -e 4 -g 5 6 7 8 9 10); get (a b c d e g h i j k args)"
          )
        ).to.eql(evaluate("idem (1 2 [false] 3 4 5 6 8 9 10 (7))"));
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

        it("should return list of subcommands", () => {
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
        mochadoc.description(usage("argspec () set"));
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
            expect(execute("help argspec {} set a b")).to.eql(
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
        expect(evaluate("argspec").type).to.eql(ValueType.COMMAND);
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
