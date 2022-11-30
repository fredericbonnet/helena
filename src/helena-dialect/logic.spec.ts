import { expect } from "chai";
import {
  BREAK,
  CONTINUE,
  ERROR,
  OK,
  ResultCode,
  RETURN,
} from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, TRUE, StringValue, NIL } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena logic operations", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

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
    describe("methods", () => {
      describe("?", () => {
        describe("true", () => {
          it("should return first argument", () => {
            expect(evaluate("true ? a b")).to.eql(new StringValue("a"));
          });
        });
        describe("false", () => {
          it("should return nil if not second argument is given", () => {
            expect(evaluate("false ? a")).to.eql(NIL);
          });
          it("should return second argument", () => {
            expect(evaluate("false ? a b")).to.eql(new StringValue("b"));
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("true ?")).to.eql(
              ERROR('wrong # args: should be "true ? arg ?arg?"')
            );
            expect(execute("false ?")).to.eql(
              ERROR('wrong # args: should be "false ? arg ?arg?"')
            );
          });
        });
      });
      describe("!?", () => {
        describe("true", () => {
          it("should return nil if not second argument is given", () => {
            expect(evaluate("true !? a")).to.eql(NIL);
          });
          it("should return second argument", () => {
            expect(evaluate("true !? a b")).to.eql(new StringValue("b"));
          });
        });
        describe("false", () => {
          it("should return first argument", () => {
            expect(evaluate("false !? a b")).to.eql(new StringValue("a"));
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("true !?")).to.eql(
              ERROR('wrong # args: should be "true !? arg ?arg?"')
            );
            expect(execute("false !?")).to.eql(
              ERROR('wrong # args: should be "false !? arg ?arg?"')
            );
          });
        });
      });
    });
    describe("exceptions", () => {
      specify("non-existing method", () => {
        expect(execute("true unknownMethod")).to.eql(
          ERROR('invalid method name "unknownMethod"')
        );
        expect(execute("false unknownMethod")).to.eql(
          ERROR('invalid method name "unknownMethod"')
        );
      });
    });
  });

  describe("prefix operations", () => {
    describe("logic", () => {
      describe("!", () => {
        it("should invert boolean values", () => {
          expect(evaluate("! true")).to.eql(FALSE);
          expect(evaluate("! false")).to.eql(TRUE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("! {idem true}")).to.eql(FALSE);
          expect(evaluate("! {idem false}")).to.eql(TRUE);
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt expression with RETURN code", () => {
              expect(execute("! {return value; unreachable}")).to.eql(
                RETURN(new StringValue("value"))
              );
            });
          });
          describe("tailcall", () => {
            it("should interrupt expression with RETURN code", () => {
              expect(execute("! {tailcall {idem value}; unreachable}")).to.eql(
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
              const state = rootScope.prepareScript(
                parse("! {yield val1; yield val2}")
              );

              let result = state.run();
              expect(result.value).to.eql(new StringValue("val1"));
              expect(result.data).to.exist;

              result = state.run();
              expect(result.value).to.eql(new StringValue("val2"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result).to.eql(OK(FALSE));
            });
          });
          describe("error", () => {
            it("should interrupt expression with ERROR code", () => {
              expect(execute("! {error msg; false}")).to.eql(ERROR("msg"));
            });
          });
          describe("break", () => {
            it("should interrupt expression with BREAK code", () => {
              expect(execute("! {break; unreachable}")).to.eql(BREAK());
            });
          });
          describe("continue", () => {
            it("should interrupt expression with CONTINUE code", () => {
              expect(execute("! {continue; false}")).to.eql(CONTINUE());
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("!")).to.eql(
              ERROR('wrong # args: should be "! arg"')
            );
          });
          specify("invalid value", () => {
            expect(execute("! 1")).to.eql(ERROR('invalid boolean "1"'));
            expect(execute("! 1.23")).to.eql(ERROR('invalid boolean "1.23"'));
            expect(execute("! a")).to.eql(ERROR('invalid boolean "a"'));
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
        it("should accept script expressions", () => {
          expect(evaluate("&& {idem false}")).to.eql(FALSE);
          expect(evaluate("&& {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on false", () => {
          expect(evaluate("&& false {unreachable}")).to.eql(FALSE);
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt expression with RETURN code", () => {
              expect(
                execute("&& true {return value; unreachable} false")
              ).to.eql(RETURN(new StringValue("value")));
            });
          });
          describe("tailcall", () => {
            it("should interrupt expression with RETURN code", () => {
              expect(
                execute("&& true {tailcall {idem value}; unreachable} false")
              ).to.eql(RETURN(new StringValue("value")));
            });
          });
          describe("yield", () => {
            it("should interrupt expression with YIELD code", () => {
              const result = execute("&& true {yield value; true}");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("value"));
            });
            it("should provide a resumable state", () => {
              const state = rootScope.prepareScript(
                parse("&& {yield val1} {yield val2} ")
              );

              let result = state.run();
              expect(result.value).to.eql(new StringValue("val1"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result.value).to.eql(new StringValue("val2"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result).to.eql(OK(FALSE));
            });
          });
          describe("error", () => {
            it("should interrupt expression with ERROR code", () => {
              expect(execute("&& true {error msg; true} false")).to.eql(
                ERROR("msg")
              );
            });
          });
          describe("break", () => {
            it("should interrupt expression with BREAK code", () => {
              expect(execute("&& true {break; unreachable} false")).to.eql(
                BREAK()
              );
            });
          });
          describe("continue", () => {
            it("should interrupt expression with CONTINUE code", () => {
              expect(execute("&& true {continue; unreachable} false")).to.eql(
                CONTINUE()
              );
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("&&")).to.eql(
              ERROR('wrong # args: should be "&& arg ?arg ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("&& a")).to.eql(ERROR('invalid boolean "a"'));
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
        it("should accept script expressions", () => {
          expect(evaluate("|| {idem false}")).to.eql(FALSE);
          expect(evaluate("|| {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on true", () => {
          expect(evaluate("|| true {unreachable}")).to.eql(TRUE);
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt expression with RETURN code", () => {
              expect(
                execute("|| false {return value; unreachable} true")
              ).to.eql(RETURN(new StringValue("value")));
            });
          });
          describe("tailcall", () => {
            it("should interrupt expression with RETURN code", () => {
              expect(
                execute("|| false {tailcall {idem value}; unreachable} true")
              ).to.eql(RETURN(new StringValue("value")));
            });
          });
          describe("yield", () => {
            it("should interrupt expression with YIELD code", () => {
              const result = execute("|| false {yield value; false}");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("value"));
            });
            it("should provide a resumable state", () => {
              const state = rootScope.prepareScript(
                parse("|| {yield val1} {yield val2} ")
              );

              let result = state.run();
              expect(result.value).to.eql(new StringValue("val1"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.value).to.eql(new StringValue("val2"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result).to.eql(OK(TRUE));
            });
          });
          describe("error", () => {
            it("should interrupt expression with ERROR code", () => {
              expect(execute("|| false {error msg; true} true")).to.eql(
                ERROR("msg")
              );
            });
          });
          describe("break", () => {
            it("should interrupt expression with BREAK code", () => {
              expect(execute("|| false {break; unreachable} true")).to.eql(
                BREAK()
              );
            });
          });
          describe("continue", () => {
            it("should interrupt expression with CONTINUE code", () => {
              expect(execute("|| false {continue; unreachable} true")).to.eql(
                CONTINUE()
              );
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("||")).to.eql(
              ERROR('wrong # args: should be "|| arg ?arg ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("|| a")).to.eql(ERROR('invalid boolean "a"'));
          });
        });
      });
    });
  });
});
