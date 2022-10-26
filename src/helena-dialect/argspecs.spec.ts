import { expect } from "chai";
import { ResultCode } from "../core/command";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { IntegerValue, TupleValue, NIL, StringValue } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { CommandValue, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena argument handling", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) =>
    rootScope.execute(rootScope.compile(parse(script)));
  const evaluate = (script: string) => {
    const result = execute(script);
    if (result.code == ResultCode.ERROR)
      throw new Error(result.value.asString());
    return result.value;
  };

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
      expect(() => evaluate("argspec cmd {}")).to.not.throw();
    });
    it("should return a command value", () => {
      expect(evaluate("argspec {}")).to.be.instanceof(CommandValue);
      expect(evaluate("argspec cmd {}")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
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
        specify("help", () => {
          expect(evaluate("[argspec ()] help")).to.eql(new StringValue(""));
        });
        specify("set", () => {
          evaluate("[argspec ()] set ()");
          expect(rootScope.context.variables).to.be.empty;
        });
      });

      describe("one parameter", () => {
        specify("value", () => {
          const value = evaluate("argspec a") as ArgspecValue;
          expect(evaluate("argspec (a)")).to.eql(value);
          expect(evaluate("argspec {a}")).to.eql(value);
          expect(value.argspec).to.include({
            nbRequired: 1,
            nbOptional: 0,
            hasRemainder: false,
          });
          expect(value.argspec.args).to.eql([{ name: "a", type: "required" }]);
        });
        specify("help", () => {
          expect(evaluate("[argspec a] help")).to.eql(new StringValue("a"));
        });
        specify("set", () => {
          evaluate("[argspec a] set val1");
          expect(evaluate("get a")).to.eql(new StringValue("val1"));
          evaluate("[argspec a] set (val2)");
          expect(evaluate("get a")).to.eql(new StringValue("val2"));
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
        specify("help", () => {
          expect(evaluate("[argspec (a b)] help")).to.eql(
            new StringValue("a b")
          );
        });
        specify("set", () => {
          evaluate("[argspec {a b}] set (val1 val2)");
          expect(evaluate("get a")).to.eql(new StringValue("val1"));
          expect(evaluate("get b")).to.eql(new StringValue("val2"));
        });
      });

      describe("remainder", () => {
        describe("anonymous", () => {
          specify("value", () => {
            const value = evaluate("argspec *") as ArgspecValue;
            expect(evaluate("argspec (*)")).to.eql(value);
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
          specify("help", () => {
            expect(evaluate("[argspec *] help")).to.eql(
              new StringValue("?arg ...?")
            );
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec *] set ()");
              expect(evaluate("get *")).to.eql(new TupleValue([]));
            });
            specify("one", () => {
              evaluate("[argspec *] set val");
              expect(evaluate("get *")).to.eql(
                new TupleValue([new StringValue("val")])
              );
            });
            specify("two", () => {
              evaluate("[argspec *] set (val1 val2)");
              expect(evaluate("get *")).to.eql(
                new TupleValue([
                  new StringValue("val1"),
                  new StringValue("val2"),
                ])
              );
            });
          });
        });

        describe("named", () => {
          specify("value", () => {
            const value = evaluate("argspec *args") as ArgspecValue;
            expect(evaluate("argspec (*args)")).to.eql(value);
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
          specify("help", () => {
            expect(evaluate("[argspec *remainder] help")).to.eql(
              new StringValue("?remainder ...?")
            );
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec *args] set ()");
              expect(evaluate("get args")).to.eql(new TupleValue([]));
            });
            specify("one", () => {
              evaluate("[argspec *args] set val");
              expect(evaluate("get args")).to.eql(
                new TupleValue([new StringValue("val")])
              );
            });
            specify("two", () => {
              evaluate("[argspec *args] set (val1 val2)");
              expect(evaluate("get args")).to.eql(
                new TupleValue([
                  new StringValue("val1"),
                  new StringValue("val2"),
                ])
              );
            });
          });
        });

        describe("prefix", () => {
          specify("one", () => {
            evaluate("[argspec (* a)] set val");
            expect(evaluate("get *")).to.eql(new TupleValue([]));
            expect(evaluate("get a")).to.eql(new StringValue("val"));
          });
          specify("two", () => {
            evaluate("[argspec (* a)] set (val1 val2)");
            expect(evaluate("get *")).to.eql(
              new TupleValue([new StringValue("val1")])
            );
            expect(evaluate("get a")).to.eql(new StringValue("val2"));
          });
          specify("three", () => {
            evaluate("[argspec (* a)] set (val1 val2 val3)");
            expect(evaluate("get *")).to.eql(
              new TupleValue([new StringValue("val1"), new StringValue("val2")])
            );
            expect(evaluate("get a")).to.eql(new StringValue("val3"));
          });
        });
        describe("infix", () => {
          specify("two", () => {
            evaluate("[argspec (a * b)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get *")).to.eql(new TupleValue([]));
            expect(evaluate("get b")).to.eql(new StringValue("val2"));
          });
          specify("three", () => {
            evaluate("[argspec (a * b)] set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get *")).to.eql(
              new TupleValue([new StringValue("val2")])
            );
            expect(evaluate("get b")).to.eql(new StringValue("val3"));
          });
          specify("four", () => {
            evaluate("[argspec (a * b)] set (val1 val2 val3 val4)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get *")).to.eql(
              new TupleValue([new StringValue("val2"), new StringValue("val3")])
            );
            expect(evaluate("get b")).to.eql(new StringValue("val4"));
          });
        });
        describe("suffix", () => {
          specify("one", () => {
            evaluate("[argspec (a *)] set val");
            expect(evaluate("get *")).to.eql(new TupleValue([]));
            expect(evaluate("get a")).to.eql(new StringValue("val"));
            expect(evaluate("get *")).to.eql(new TupleValue([]));
          });
          specify("two", () => {
            evaluate("[argspec (a *)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get *")).to.eql(
              new TupleValue([new StringValue("val2")])
            );
          });
          specify("three", () => {
            evaluate("[argspec (a *)] set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get *")).to.eql(
              new TupleValue([new StringValue("val2"), new StringValue("val3")])
            );
          });
        });

        it("cannot be used more than once", () => {
          expect(() => evaluate("argspec (* *)")).to.throw(
            "only one remainder argument is allowed"
          );
          expect(() => evaluate("argspec (*a *b)")).to.throw(
            "only one remainder argument is allowed"
          );
        });
      });

      describe("optional parameter", () => {
        describe("single", () => {
          specify("value", () => {
            const value = evaluate("argspec ?a") as ArgspecValue;
            expect(evaluate("argspec (?a)")).to.eql(value);
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
          specify("help", () => {
            expect(evaluate("[argspec ?a] help")).to.eql(
              new StringValue("?a?")
            );
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec ?a] set ()");
              expect(() => evaluate("get a")).to.throw(
                `can't read "a": no such variable`
              );
            });
            specify("one", () => {
              evaluate("[argspec ?a] set (val)");
              expect(evaluate("get a")).to.eql(new StringValue("val"));
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
          specify("help", () => {
            expect(evaluate("[argspec (?a ?b)] help")).to.eql(
              new StringValue("?a? ?b?")
            );
          });
          describe("set", () => {
            specify("zero", () => {
              evaluate("[argspec (?a ?b)] set ()");
              expect(() => evaluate("get a")).to.throw(
                `can't read "a": no such variable`
              );
              expect(() => evaluate("get b")).to.throw(
                `can't read "b": no such variable`
              );
            });
            specify("one", () => {
              evaluate("[argspec (?a ?b)] set (val)");
              expect(evaluate("get a")).to.eql(new StringValue("val"));
              expect(() => evaluate("get b")).to.throw(
                `can't read "b": no such variable`
              );
            });
            specify("one two", () => {
              evaluate("[argspec (?a ?b)] set (val1 val2)");
              expect(evaluate("get a")).to.eql(new StringValue("val1"));
              expect(evaluate("get b")).to.eql(new StringValue("val2"));
            });
          });
        });

        describe("prefix", () => {
          specify("one", () => {
            evaluate("[argspec (?a b)] set (val)");
            expect(() => evaluate("get a")).to.throw(
              `can't read "a": no such variable`
            );
            expect(evaluate("get b")).to.eql(new StringValue("val"));
          });
          specify("two", () => {
            evaluate("[argspec (?a b)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get b")).to.eql(new StringValue("val2"));
          });
        });
        describe("infix", () => {
          specify("two", () => {
            evaluate("[argspec (a ?b c)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(() => evaluate("get b")).to.throw(
              `can't read "b": no such variable`
            );
            expect(evaluate("get c")).to.eql(new StringValue("val2"));
          });
          specify("three", () => {
            evaluate("[argspec (a ?b c)] set (val1 val2 val3)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get b")).to.eql(new StringValue("val2"));
            expect(evaluate("get c")).to.eql(new StringValue("val3"));
          });
        });
        describe("suffix", () => {
          specify("one", () => {
            evaluate("[argspec (a ?b)] set (val)");
            expect(evaluate("get a")).to.eql(new StringValue("val"));
            expect(() => evaluate("get b")).to.throw(
              `can't read "b": no such variable`
            );
          });
          specify("two", () => {
            evaluate("[argspec (a ?b)] set (val1 val2)");
            expect(evaluate("get a")).to.eql(new StringValue("val1"));
            expect(evaluate("get b")).to.eql(new StringValue("val2"));
          });
        });
      });

      describe("default value", () => {
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
            { name: "a", type: "optional", default: new StringValue("val") },
          ]);
        });
        specify("help", () => {
          expect(evaluate("[argspec ((?a def))] help")).to.eql(
            new StringValue("?a?")
          );
        });
        describe("set", () => {
          describe("static", () => {
            specify("zero", () => {
              evaluate("[argspec ((?a def))] set ()");
              expect(evaluate("get a")).to.eql(new StringValue("def"));
            });
            specify("one", () => {
              evaluate("[argspec ((?a def))] set (val)");
              expect(evaluate("get a")).to.eql(new StringValue("val"));
            });
          });
          describe("dynamic", () => {
            specify("zero", () => {
              evaluate("[argspec ((?a {+ 1 2}))] set ()");
              expect(evaluate("get a")).to.eql(new IntegerValue(3));
            });
            specify("one", () => {
              evaluate("[argspec ((?a def))] set (val)");
              expect(evaluate("get a")).to.eql(new StringValue("val"));
            });
          });
        });
      });
    });
    describe("methods", () => {
      describe("help", () => {
        it("should return a help string with argument names", () => {
          expect(evaluate("[argspec {a b ?c *}] help")).to.eql(
            new StringValue("a b ?c? ?arg ...?")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[argspec {}] help a")).to.throw(
              'wrong # args: should be "argspec help"'
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
          expect(evaluate("get a")).to.eql(new StringValue("val"));
        });
        it("should enforce minimum number of arguments", () => {
          expect(() => evaluate("[argspec {a}] set ()")).to.throw(
            `wrong # values: should be "a"`
          );
          expect(() => evaluate("[argspec {a ?b}] set ()")).to.throw(
            `wrong # values: should be "a ?b?"`
          );
          expect(() => evaluate("[argspec {?a b c}] set (val)")).to.throw(
            `wrong # values: should be "?a? b c"`
          );
          expect(() => evaluate("[argspec {a *b c}] set (val)")).to.throw(
            `wrong # values: should be "a ?b ...? c"`
          );
        });
        it("should enforce maximum number of arguments", () => {
          expect(() => evaluate("[argspec {}] set (val1)")).to.throw(
            `wrong # values: should be ""`
          );
          expect(() => evaluate("[argspec {a}] set (val1 val2)")).to.throw(
            `wrong # values: should be "a"`
          );
          expect(() =>
            evaluate("[argspec {a ?b}] set (val1 val2 val3)")
          ).to.throw(`wrong # values: should be "a ?b?"`);
        });
        it("should set required attributes first", () => {
          evaluate("[argspec {?a b ?c}] set (val)");
          expect(evaluate("get b")).to.eql(new StringValue("val"));
        });
        it("should skip missing optional attributes", () => {
          evaluate("[argspec {?a b (c def)}] set (val)");
          expect(() => evaluate("get a")).to.throw(
            `can't read "a": no such variable`
          );
          expect(evaluate("get b")).to.eql(new StringValue("val"));
          expect(evaluate("get c")).to.eql(new StringValue("def"));
        });
        it("should set optional attributes in order", () => {
          evaluate("[argspec {(a def) b ?c}] set (val1 val2)");
          expect(evaluate("get a")).to.eql(new StringValue("val1"));
          expect(evaluate("get b")).to.eql(new StringValue("val2"));
          expect(() => evaluate("get c")).to.throw(
            `can't read "c": no such variable`
          );
        });
        it("should set remainder after optional attributes", () => {
          evaluate("[argspec {?a *b c}] set (val1 val2)");
          expect(evaluate("get a")).to.eql(new StringValue("val1"));
          expect(evaluate("get b")).to.eql(new TupleValue([]));
          expect(evaluate("get c")).to.eql(new StringValue("val2"));
        });
        it("should set all present attributes in order", () => {
          evaluate("[argspec {?a *b c}] set (val1 val2 val3 val4)");
          expect(evaluate("get a")).to.eql(new StringValue("val1"));
          expect(evaluate("get b")).to.eql(
            new TupleValue([new StringValue("val2"), new StringValue("val3")])
          );
          expect(evaluate("get c")).to.eql(new StringValue("val4"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[argspec {}] set")).to.throw(
              'wrong # args: should be "argspec set values"'
            );
            expect(() => evaluate("[argspec {}] set a b")).to.throw(
              'wrong # args: should be "argspec set values"'
            );
          });
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("argspec")).to.throw(
          'wrong # args: should be "argspec ?name? specs"'
        );
        expect(() => evaluate("argspec a b c")).to.throw(
          'wrong # args: should be "argspec ?name? specs"'
        );
      });
      specify("empty argument name", () => {
        expect(() => evaluate('argspec ("")')).to.throw("empty argument name");
        expect(() => evaluate("argspec (?)")).to.throw("empty argument name");
        expect(() => evaluate('argspec ((""))')).to.throw(
          "empty argument name"
        );
        expect(() => evaluate("argspec ((?))")).to.throw("empty argument name");
      });
      specify("duplicate arguments", () => {
        expect(() => evaluate("argspec (a a)")).to.throw(
          'duplicate argument "a"'
        );
        expect(() => evaluate("argspec ((a def) a)")).to.throw(
          'duplicate argument "a"'
        );
        expect(() => evaluate("argspec (a (a def))")).to.throw(
          'duplicate argument "a"'
        );
      });
      specify("empty argument specifier", () => {
        expect(() => evaluate("argspec (())")).to.throw(
          "empty argument specifier"
        );
        expect(() => evaluate("argspec ({})")).to.throw(
          "empty argument specifier"
        );
      });
      specify("too many specifiers", () => {
        expect(() => evaluate("argspec ((a b c))")).to.throw(
          'too many specifiers for argument "a"'
        );
        expect(() => evaluate("argspec ({a b c})")).to.throw(
          'too many specifiers for argument "a"'
        );
      });
    });
  });
});
