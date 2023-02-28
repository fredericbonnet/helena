import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { INT, STR, TUPLE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena tuples", () => {
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

  describe("tuple", () => {
    it("should return tuple value", () => {
      expect(evaluate("tuple ()")).to.eql(TUPLE([]));
    });
    it("should convert lists to tuple", () => {
      expect(evaluate("tuple [list (a b c)]")).to.eql(
        TUPLE([STR("a"), STR("b"), STR("c")])
      );
    });
    it("should convert blocks to tuples", () => {
      expect(evaluate("tuple {a b c}")).to.eql(evaluate("tuple (a b c)"));
    });
    describe("subcommands", () => {
      describe("subcommands", () => {
        it("should return list of subcommands", () => {
          expect(evaluate("tuple () subcommands")).to.eql(
            evaluate("list (subcommands length at)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("tuple () subcommands a")).to.eql(
              ERROR('wrong # args: should be "tuple value subcommands"')
            );
          });
        });
      });
      describe("length", () => {
        it("should return the tuple length", () => {
          expect(evaluate("tuple () length")).to.eql(INT(0));
          expect(evaluate("tuple (a b c) length")).to.eql(INT(3));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("tuple () length a")).to.eql(
              ERROR('wrong # args: should be "tuple value length"')
            );
          });
        });
      });
      describe("at", () => {
        it("should return the element at the given index", () => {
          expect(evaluate("tuple (a b c) at 1")).to.eql(STR("b"));
        });
        it("should return the default value for an out-of-range index", () => {
          expect(evaluate("tuple (a b c) at 10 default")).to.eql(
            STR("default")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("tuple (a b c) at")).to.eql(
              ERROR('wrong # args: should be "tuple value at index ?default?"')
            );
            expect(execute("tuple (a b c) at a b c")).to.eql(
              ERROR('wrong # args: should be "tuple value at index ?default?"')
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
      describe("exceptions", () => {
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
    describe("exceptions", () => {
      specify("invalid values", () => {
        expect(execute("tuple []")).to.eql(ERROR("invalid tuple"));
        expect(execute("tuple [1]")).to.eql(ERROR("invalid tuple"));
        expect(execute("tuple a")).to.eql(ERROR("invalid tuple"));
      });
      specify("blocks with side effects", () => {
        expect(execute("tuple { $a }")).to.eql(ERROR("invalid list"));
        expect(execute("tuple { [b] }")).to.eql(ERROR("invalid list"));
        expect(execute("tuple { $[][a] }")).to.eql(ERROR("invalid list"));
        expect(execute("tuple { $[](a) }")).to.eql(ERROR("invalid list"));
      });
    });
  });

  describe("currying", () => {
    specify("identity", () => {
      evaluate("set l (tuple (a b c))");
      expect(evaluate("$l")).to.eql(evaluate("tuple (a b c)"));
    });
    specify("length", () => {
      evaluate("set l (tuple (a b c))");
      expect(evaluate("$l length")).to.eql(INT(3));
    });
    specify("at", () => {
      evaluate("set l (tuple (a b c))");
      expect(evaluate("$l at 2")).to.eql(STR("c"));
    });
  });
});
