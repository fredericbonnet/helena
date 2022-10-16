import { expect } from "chai";
import { OK, ResultCode, RETURN } from "../core/command";
import { Process } from "../core/compiler";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, TRUE, StringValue } from "../core/values";
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
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt expression with RESULT code", () => {
              expect(execute("! {return value; error}")).to.eql(
                RETURN(new StringValue("value"))
              );
            });
          });
          describe("yield", () => {
            it("should interrupt expression with YIELD code", () => {
              const result = execute("! {yield value; true}");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("value"));
            });
            it("should provide a resumable state", () => {
              const process = new Process();
              const program = rootScope.compile(
                parse("! {yield val1; yield val2; true}")
              );

              let result = rootScope.execute(program, process);
              expect(result.state).to.exist;

              result = rootScope.execute(program, process);
              expect(result.state).to.exist;

              result = rootScope.execute(program, process);
              expect(result).to.eql(OK(FALSE));
            });
          });
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
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt expression with RESULT code", () => {
              expect(execute("&& true {return value; error} false")).to.eql(
                RETURN(new StringValue("value"))
              );
            });
          });
          describe("yield", () => {
            it("should interrupt expression with YIELD code", () => {
              const result = execute("&& true {yield value; true}");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("value"));
            });
            it("should provide a resumable state", () => {
              const process = new Process();
              const program = rootScope.compile(
                parse("&& {yield val1; true} {yield val2; false} ")
              );

              let result = rootScope.execute(program, process);
              expect(result.state).to.exist;

              result = rootScope.execute(program, process);
              expect(result.state).to.exist;

              result = rootScope.execute(program, process);
              expect(result).to.eql(OK(FALSE));
            });
          });
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
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt expression with RESULT code", () => {
              expect(execute("|| false {return value; error} true")).to.eql(
                RETURN(new StringValue("value"))
              );
            });
          });
          describe("yield", () => {
            it("should interrupt expression with YIELD code", () => {
              const result = execute("|| false {yield value; false}");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("value"));
            });
            it("should provide a resumable state", () => {
              const process = new Process();
              const program = rootScope.compile(
                parse("|| {yield val1; false} {yield val2; true} ")
              );

              let result = rootScope.execute(program, process);
              expect(result.state).to.exist;

              result = rootScope.execute(program, process);
              expect(result.state).to.exist;

              result = rootScope.execute(program, process);
              expect(result).to.eql(OK(TRUE));
            });
          });
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
