import { expect } from "chai";
import { ResultCode } from "../core/command";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena logic operations", () => {
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

  describe("booleans", () => {
    it("are valid commands", () => {
      expect(evaluate("true")).to.eql(TRUE);
      expect(evaluate("false")).to.eql(FALSE);
    });
    it("are idempotent", () => {
      expect(evaluate("[true]")).to.eql(TRUE);
      expect(evaluate("[false]")).to.eql(FALSE);
    });
  });

  describe("prefix operations", () => {
    describe("logic", () => {
      describe("!", () => {
        it("should invert boolean values", () => {
          expect(evaluate("! true")).to.eql(FALSE);
          expect(evaluate("! false")).to.eql(TRUE);
        });
        it("should accept block expressions", () => {
          expect(evaluate("! {idem true}")).to.eql(FALSE);
          expect(evaluate("! {idem false}")).to.eql(TRUE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("!")).to.throw(
              'wrong # args: should be "! arg"'
            );
          });
          specify("invalid value", () => {
            expect(() => evaluate("! 1")).to.throw('invalid boolean "1"');
            expect(() => evaluate("! 1.23")).to.throw('invalid boolean "1.23"');
            expect(() => evaluate("! a")).to.throw('invalid boolean "a"');
          });
        });
      });
      describe("&&", () => {
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
        it("should accept block expressions", () => {
          expect(evaluate("&& {idem false}")).to.eql(FALSE);
          expect(evaluate("&& {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on false", () => {
          expect(evaluate("&& false {error}")).to.eql(FALSE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("&&")).to.throw(
              'wrong # args: should be "&& arg ?arg ...?"'
            );
          });
          specify("invalid value", () => {
            expect(() => evaluate("&& a")).to.throw('invalid boolean "a"');
          });
        });
      });
      describe("||", () => {
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
        it("should accept block expressions", () => {
          expect(evaluate("|| {idem false}")).to.eql(FALSE);
          expect(evaluate("|| {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on true", () => {
          expect(evaluate("|| true {error}")).to.eql(TRUE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("||")).to.throw(
              'wrong # args: should be "|| arg ?arg ...?"'
            );
          });
          specify("invalid value", () => {
            expect(() => evaluate("|| a")).to.throw('invalid boolean "a"');
          });
        });
      });
    });
  });
});
