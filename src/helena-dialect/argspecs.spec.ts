import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, TRUE, FALSE, INT, STR, TUPLE } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena argument handling", () => {
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

  describe("argspec", () => {
    it("should define a new command", () => {
      evaluate("argspec cmd {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("argspec cmd {}");
      expect(execute("argspec cmd {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command object", () => {
      expect(evaluate("argspec {}").type).to.eql(commandValueType);
      expect(evaluate("argspec cmd {}").type).to.eql(commandValueType);
    });
    specify("the named command should return its command object", () => {
      const value = evaluate("argspec cmd {}");
      expect(evaluate("cmd")).to.eql(value);
    });
    specify("the command object should return itself", () => {
      const value = evaluate("set cmd [argspec {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("specs", () => {
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
          expect(evaluate("[argspec ()] usage")).to.eql(STR(""));
        });
        specify("set", () => {
          evaluate("[argspec ()] set ()");
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
          expect(evaluate("[argspec (a)] usage")).to.eql(STR("a"));
        });
        specify("set", () => {
          evaluate("[argspec (a)] set (val1)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          evaluate("[argspec (a)] set (val2)");
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
          expect(evaluate("[argspec (a b)] usage")).to.eql(STR("a b"));
        });
        specify("set", () => {
          evaluate("[argspec {a b}] set (val1 val2)");
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
            expect(evaluate("[argspec (*)] usage")).to.eql(STR("?arg ...?"));
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec (*)] set ()");
              expect(evaluate("get *")).to.eql(TUPLE([]));
            });
            specify("one", () => {
              evaluate("[argspec (*)] set (val)");
              expect(evaluate("get *")).to.eql(TUPLE([STR("val")]));
            });
            specify("two", () => {
              evaluate("[argspec (*)] set (val1 val2)");
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
            expect(evaluate("[argspec (*remainder)] usage")).to.eql(
              STR("?remainder ...?")
            );
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec (*args)] set ()");
              expect(evaluate("get args")).to.eql(TUPLE([]));
            });
            specify("one", () => {
              evaluate("[argspec (*args)] set (val)");
              expect(evaluate("get args")).to.eql(TUPLE([STR("val")]));
            });
            specify("two", () => {
              evaluate("[argspec (*args)] set (val1 val2)");
              expect(evaluate("get args")).to.eql(
                TUPLE([STR("val1"), STR("val2")])
              );
            });
          });
        });

        describe("prefix", () => {
          specify("one", () => {
            evaluate("[argspec (* a)] set (val)");
            expect(evaluate("get *")).to.eql(TUPLE([]));
            expect(evaluate("get a")).to.eql(STR("val"));
          });
          specify("two", () => {
            evaluate("[argspec (* a)] set (val1 val2)");
            expect(evaluate("get *")).to.eql(TUPLE([STR("val1")]));
            expect(evaluate("get a")).to.eql(STR("val2"));
          });
          specify("three", () => {
            evaluate("[argspec (* a)] set (val1 val2 val3)");
            expect(evaluate("get *")).to.eql(TUPLE([STR("val1"), STR("val2")]));
            expect(evaluate("get a")).to.eql(STR("val3"));
          });
        });
        describe("infix", () => {
          specify("two", () => {
            evaluate("[argspec (a * b)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([]));
            expect(evaluate("get b")).to.eql(STR("val2"));
          });
          specify("three", () => {
            evaluate("[argspec (a * b)] set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2")]));
            expect(evaluate("get b")).to.eql(STR("val3"));
          });
          specify("four", () => {
            evaluate("[argspec (a * b)] set (val1 val2 val3 val4)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2"), STR("val3")]));
            expect(evaluate("get b")).to.eql(STR("val4"));
          });
        });
        describe("suffix", () => {
          specify("one", () => {
            evaluate("[argspec (a *)] set (val)");
            expect(evaluate("get *")).to.eql(TUPLE([]));
            expect(evaluate("get a")).to.eql(STR("val"));
            expect(evaluate("get *")).to.eql(TUPLE([]));
          });
          specify("two", () => {
            evaluate("[argspec (a *)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get *")).to.eql(TUPLE([STR("val2")]));
          });
          specify("three", () => {
            evaluate("[argspec (a *)] set (val1 val2 val3)");
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
            expect(evaluate("[argspec (?a)] usage")).to.eql(STR("?a?"));
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec ?a] set ()");
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
            });
            specify("one", () => {
              evaluate("[argspec (?a)] set (val)");
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
            expect(evaluate("[argspec (?a ?b)] usage")).to.eql(STR("?a? ?b?"));
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec (?a ?b)] set ()");
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
              expect(execute("get b")).to.eql(
                ERROR(`cannot get "b": no such variable`)
              );
            });
            specify("one", () => {
              evaluate("[argspec (?a ?b)] set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
              expect(execute("get b")).to.eql(
                ERROR(`cannot get "b": no such variable`)
              );
            });
            specify("one two", () => {
              evaluate("[argspec (?a ?b)] set (val1 val2)");
              expect(evaluate("get a")).to.eql(STR("val1"));
              expect(evaluate("get b")).to.eql(STR("val2"));
            });
          });
        });

        describe("prefix", () => {
          specify("one", () => {
            evaluate("[argspec (?a b)] set (val)");
            expect(execute("get a")).to.eql(
              ERROR(`cannot get "a": no such variable`)
            );
            expect(evaluate("get b")).to.eql(STR("val"));
          });
          specify("two", () => {
            evaluate("[argspec (?a b)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
          });
        });
        describe("infix", () => {
          specify("two", () => {
            evaluate("[argspec (a ?b c)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(execute("get b")).to.eql(
              ERROR(`cannot get "b": no such variable`)
            );
            expect(evaluate("get c")).to.eql(STR("val2"));
          });
          specify("three", () => {
            evaluate("[argspec (a ?b c)] set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(STR("val1"));
            expect(evaluate("get b")).to.eql(STR("val2"));
            expect(evaluate("get c")).to.eql(STR("val3"));
          });
        });
        describe("suffix", () => {
          specify("one", () => {
            evaluate("[argspec (a ?b)] set (val)");
            expect(evaluate("get a")).to.eql(STR("val"));
            expect(execute("get b")).to.eql(
              ERROR(`cannot get "b": no such variable`)
            );
          });
          specify("two", () => {
            evaluate("[argspec (a ?b)] set (val1 val2)");
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
          expect(evaluate("[argspec ((?a def))] usage")).to.eql(STR("?a?"));
        });
        describe("set", () => {
          describe("static", () => {
            specify("zero", () => {
              evaluate("[argspec ((?a def))] set ()");
              expect(evaluate("get a")).to.eql(STR("def"));
            });
            specify("one", () => {
              evaluate("[argspec ((?a def))] set (val)");
              expect(evaluate("get a")).to.eql(STR("val"));
            });
          });
          describe("dynamic", () => {
            specify("zero", () => {
              evaluate("[argspec ((?a {+ 1 2}))] set ()");
              expect(evaluate("get a")).to.eql(INT(3));
            });
            specify("one", () => {
              evaluate("[argspec ((?a def))] set (val)");
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
          expect(evaluate("[argspec ((guard ?a def))] usage")).to.eql(
            STR("?a?")
          );
        });
        describe("set", () => {
          describe("simple command", () => {
            specify("required", () => {
              evaluate("argspec cmd ( (list a) )");
              expect(execute("cmd set ((1 2 3))")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list (1 2 3)"));
              expect(execute("cmd set (value)")).to.eql(ERROR("invalid list"));
            });
            specify("optional", () => {
              evaluate("argspec cmd ( (list ?a) )");
              expect(execute("cmd set ()")).to.eql(OK(NIL));
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
              expect(execute("cmd set ((1 2 3))")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list (1 2 3)"));
              expect(execute("cmd set (value)")).to.eql(ERROR("invalid list"));
            });
            specify("default", () => {
              evaluate("argspec cmd ( (list ?a ()) )");
              expect(execute("cmd set ()")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list ()"));
              expect(execute("cmd set ((1 2 3))")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(evaluate("list (1 2 3)"));
              expect(execute("cmd set (value)")).to.eql(ERROR("invalid list"));
            });
          });
          describe("tuple prefix", () => {
            specify("required", () => {
              evaluate("argspec cmd ( ((0 <) a) )");
              expect(execute("cmd set (1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("cmd set (-1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(FALSE);
              expect(execute("cmd set (value)")).to.eql(
                ERROR('invalid number "value"')
              );
            });
            specify("optional", () => {
              evaluate("argspec cmd ( ((0 <) ?a) )");
              expect(execute("cmd set ()")).to.eql(OK(NIL));
              expect(execute("get a")).to.eql(
                ERROR(`cannot get "a": no such variable`)
              );
              expect(execute("cmd set (1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("cmd set (-1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(FALSE);
              expect(execute("cmd set (value)")).to.eql(
                ERROR('invalid number "value"')
              );
            });
            specify("default", () => {
              evaluate("argspec cmd ( ((0 <) ?a 1) )");
              expect(execute("cmd set ()")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("cmd set (1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(TRUE);
              expect(execute("cmd set (-1)")).to.eql(OK(NIL));
              expect(evaluate("get a")).to.eql(FALSE);
              expect(execute("cmd set (value)")).to.eql(
                ERROR('invalid number "value"')
              );
            });
          });
        });
      });
    });
    describe("subcommands", () => {
      describe("subcommands", () => {
        it("should return list of subcommands", () => {
          expect(evaluate("[argspec {}] subcommands")).to.eql(
            evaluate("list (subcommands usage set)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[argspec {}] subcommands a")).to.eql(
              ERROR('wrong # args: should be "<argspec> subcommands"')
            );
          });
        });
      });
      describe("usage", () => {
        it("should return a usage string with argument names", () => {
          expect(evaluate("[argspec {a b ?c *}] usage")).to.eql(
            STR("a b ?c? ?arg ...?")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[argspec {}] usage a")).to.eql(
              ERROR('wrong # args: should be "<argspec> usage"')
            );
          });
        });
      });
      describe("set", () => {
        it("should return nil", () => {
          expect(evaluate("[argspec {}] set ()")).to.eql(NIL);
        });
        it("should set argument variables in the caller scope", () => {
          evaluate("[argspec {a}] set (val)");
          expect(evaluate("get a")).to.eql(STR("val"));
        });
        it("should enforce minimum number of arguments", () => {
          expect(execute("[argspec {a}] set ()")).to.eql(
            ERROR(`wrong # values: should be "a"`)
          );
          expect(execute("[argspec {a ?b}] set ()")).to.eql(
            ERROR(`wrong # values: should be "a ?b?"`)
          );
          expect(execute("[argspec {?a b c}] set (val)")).to.eql(
            ERROR(`wrong # values: should be "?a? b c"`)
          );
          expect(execute("[argspec {a *b c}] set (val)")).to.eql(
            ERROR(`wrong # values: should be "a ?b ...? c"`)
          );
        });
        it("should enforce maximum number of arguments", () => {
          expect(execute("[argspec {}] set (val1)")).to.eql(
            ERROR(`wrong # values: should be ""`)
          );
          expect(execute("[argspec {a}] set (val1 val2)")).to.eql(
            ERROR(`wrong # values: should be "a"`)
          );
          expect(execute("[argspec {a ?b}] set (val1 val2 val3)")).to.eql(
            ERROR(`wrong # values: should be "a ?b?"`)
          );
        });
        it("should set required attributes first", () => {
          evaluate("[argspec {?a b ?c}] set (val)");
          expect(evaluate("get b")).to.eql(STR("val"));
        });
        it("should skip missing optional attributes", () => {
          evaluate("[argspec {?a b (?c def)}] set (val)");
          expect(execute("get a")).to.eql(
            ERROR(`cannot get "a": no such variable`)
          );
          expect(evaluate("get b")).to.eql(STR("val"));
          expect(evaluate("get c")).to.eql(STR("def"));
        });
        it("should set optional attributes in order", () => {
          evaluate("[argspec {(?a def) b ?c}] set (val1 val2)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(STR("val2"));
          expect(execute("get c")).to.eql(
            ERROR(`cannot get "c": no such variable`)
          );
        });
        it("should set remainder after optional attributes", () => {
          evaluate("[argspec {?a *b c}] set (val1 val2)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(TUPLE([]));
          expect(evaluate("get c")).to.eql(STR("val2"));
        });
        it("should set all present attributes in order", () => {
          evaluate("[argspec {?a *b c}] set (val1 val2 val3 val4)");
          expect(evaluate("get a")).to.eql(STR("val1"));
          expect(evaluate("get b")).to.eql(TUPLE([STR("val2"), STR("val3")]));
          expect(evaluate("get c")).to.eql(STR("val4"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[argspec {}] set")).to.eql(
              ERROR('wrong # args: should be "<argspec> set values"')
            );
            expect(execute("[argspec {}] set a b")).to.eql(
              ERROR('wrong # args: should be "<argspec> set values"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("[argspec {}] unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("[argspec {}] []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("argspec")).to.eql(
          ERROR('wrong # args: should be "argspec ?name? specs"')
        );
        expect(execute("argspec a b c")).to.eql(
          ERROR('wrong # args: should be "argspec ?name? specs"')
        );
      });
      specify("empty argument name", () => {
        expect(execute('argspec ("")')).to.eql(ERROR("empty argument name"));
        expect(execute("argspec (?)")).to.eql(ERROR("empty argument name"));
        expect(execute('argspec ((""))')).to.eql(ERROR("empty argument name"));
        expect(execute("argspec ((?))")).to.eql(ERROR("empty argument name"));
      });
      specify("invalid argument name", () => {
        expect(execute("argspec ([])")).to.eql(ERROR("invalid argument name"));
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
      specify("invalid command name", () => {
        expect(execute("argspec [] {}")).to.eql(ERROR("invalid command name"));
      });
    });
  });
});
