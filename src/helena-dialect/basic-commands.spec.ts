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
import { NIL, StringValue, TupleValue } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena basic commands", () => {
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

  describe("idem", () => {
    it("should return its argument", () => {
      expect(evaluate("idem val")).to.eql(new StringValue("val"));
      expect(evaluate("idem (a b c)")).to.eql(
        new TupleValue([
          new StringValue("a"),
          new StringValue("b"),
          new StringValue("c"),
        ])
      );
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("idem")).to.eql(
          ERROR('wrong # args: should be "idem value"')
        );
        expect(execute("idem a b")).to.eql(
          ERROR('wrong # args: should be "idem value"')
        );
      });
    });
  });

  describe("return", () => {
    specify("result code should be RETURN", () => {
      expect(execute("return").code).to.eql(ResultCode.RETURN);
    });
    it("should return nil by default", () => {
      expect(evaluate("return")).to.eql(NIL);
    });
    it("should return an optional result", () => {
      expect(evaluate("return val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("return a b")).to.eql(
          ERROR('wrong # args: should be "return ?result?"')
        );
      });
    });
  });

  describe("tailcall", () => {
    it("should return the result of the script body", () => {
      expect(execute("tailcall {}")).to.eql(RETURN(NIL));
      expect(execute("tailcall {idem val}")).to.eql(
        RETURN(new StringValue("val"))
      );
      expect(execute("tailcall {return val}")).to.eql(
        RETURN(new StringValue("val"))
      );
      expect(execute("tailcall {error msg}")).to.eql(ERROR("msg"));
      expect(execute("tailcall {break}")).to.eql(BREAK());
      expect(execute("tailcall {continue}")).to.eql(CONTINUE());
    });
    it("should return the result of the tuple body", () => {
      expect(execute("tailcall (idem val); unreachable")).to.eql(
        RETURN(new StringValue("val"))
      );
      expect(execute("tailcall (return val); unreachable")).to.eql(
        RETURN(new StringValue("val"))
      );
      expect(execute("tailcall (error msg); unreachable")).to.eql(ERROR("msg"));
      expect(execute("tailcall (break); unreachable")).to.eql(BREAK());
      expect(execute("tailcall (continue); unreachable")).to.eql(CONTINUE());
    });
    it("should interrupt the script", () => {
      expect(execute("tailcall {idem val}; unreachable")).to.eql(
        RETURN(new StringValue("val"))
      );
      expect(execute("tailcall (idem val); unreachable")).to.eql(
        RETURN(new StringValue("val"))
      );
    });
    it("should work recursively", () => {
      expect(
        execute("tailcall {tailcall (idem val); unreachable}; unreachable")
      ).to.eql(RETURN(new StringValue("val")));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("tailcall")).to.eql(
          ERROR('wrong # args: should be "tailcall body"')
        );
        expect(execute("tailcall a b")).to.eql(
          ERROR('wrong # args: should be "tailcall body"')
        );
      });
      specify("invalid body", () => {
        expect(execute("tailcall 1")).to.eql(
          ERROR("body must be a script or tuple")
        );
      });
    });
  });

  describe("yield", () => {
    specify("result code should be YIELD", () => {
      expect(execute("yield").code).to.eql(ResultCode.YIELD);
    });
    it("should yield nil by default", () => {
      expect(evaluate("yield")).to.eql(NIL);
    });
    it("should yield an optional result", () => {
      expect(evaluate("yield val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("yield a b")).to.eql(
          ERROR('wrong # args: should be "yield ?result?"')
        );
      });
    });
  });

  describe("error", () => {
    specify("result code should be ERROR", () => {
      expect(execute("error a").code).to.eql(ResultCode.ERROR);
    });
    specify("result value should be message", () => {
      expect(evaluate("error val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("error")).to.eql(
          ERROR('wrong # args: should be "error message"')
        );
        expect(execute("error a b")).to.eql(
          ERROR('wrong # args: should be "error message"')
        );
      });
      specify("non-string message", () => {
        expect(() => execute("error ()")).to.throw(
          "tuples have no string representation"
        );
      });
    });
  });

  describe("break", () => {
    specify("result code should be BREAK", () => {
      expect(execute("break").code).to.eql(ResultCode.BREAK);
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("break a")).to.eql(
          ERROR('wrong # args: should be "break"')
        );
      });
    });
  });

  describe("continue", () => {
    specify("result code should be CONTINUE", () => {
      expect(execute("continue").code).to.eql(ResultCode.CONTINUE);
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("continue a")).to.eql(
          ERROR('wrong # args: should be "continue"')
        );
      });
    });
  });

  describe("eval", () => {
    it("should return nil for empty body", () => {
      expect(evaluate("eval {}")).to.eql(NIL);
    });
    it("should return the result of the last command", () => {
      expect(execute("eval {idem val1; idem val2}")).to.eql(
        OK(new StringValue("val2"))
      );
    });
    it("should evaluate the body", () => {
      evaluate("eval {let var val}");
      expect(evaluate("get var")).to.eql(new StringValue("val"));
    });
    it("should accept tuple bodies", () => {
      expect(evaluate("eval (idem val)")).to.eql(new StringValue("val"));
    });
    it("should work recursively", () => {
      const state = rootScope.prepareScript(
        parse("eval {eval {yield val1}; yield val2; eval {yield val3}}")
      );

      let result = state.run();
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.eql(new StringValue("val1"));

      result = state.run();
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.eql(new StringValue("val2"));

      result = state.run();
      expect(result.code).to.eql(ResultCode.YIELD);
      expect(result.value).to.eql(new StringValue("val3"));

      state.yieldBack(new StringValue("val4"));
      result = state.run();
      expect(result).to.eql(OK(new StringValue("val4")));
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt the body with RETURN code", () => {
          expect(
            execute("eval {set var val1; return; set var val2}").code
          ).to.eql(ResultCode.RETURN);
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should return passed value", () => {
          expect(execute("eval {return val}")).to.eql(
            RETURN(new StringValue("val"))
          );
        });
      });
      describe("tailcall", () => {
        it("should interrupt the body with RETURN code", () => {
          expect(
            execute("eval {set var val1; tailcall {}; set var val2}").code
          ).to.eql(ResultCode.RETURN);
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should return tailcall result", () => {
          expect(execute("eval {tailcall {idem val}}")).to.eql(
            RETURN(new StringValue("val"))
          );
        });
      });
      describe("yield", () => {
        it("should interrupt the body with YIELD code", () => {
          expect(
            execute("eval {set var val1; yield; set var val2}").code
          ).to.eql(ResultCode.YIELD);
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          const state = rootScope.prepareScript(
            parse("eval {set var val1; set var _[yield val2]_}")
          );

          let result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));
          expect(evaluate("get var")).to.eql(new StringValue("val1"));

          state.yieldBack(new StringValue("val3"));
          result = state.run();
          expect(result).to.eql(OK(new StringValue("_val3_")));
          expect(evaluate("get var")).to.eql(new StringValue("_val3_"));
        });
      });
      describe("error", () => {
        it("should interrupt the body with ERROR code", () => {
          expect(
            execute("eval {set var val1; error msg; set var val2}")
          ).to.eql(ERROR("msg"));
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
      });
      describe("break", () => {
        it("should interrupt the body with BREAK code", () => {
          expect(execute("eval {set var val1; break; set var val2}")).to.eql(
            BREAK()
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
      });
      describe("continue", () => {
        it("should interrupt the body with CONTINUE code", () => {
          expect(execute("eval {set var val1; continue; set var val2}")).to.eql(
            CONTINUE()
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("eval")).to.eql(
          ERROR('wrong # args: should be "eval body"')
        );
        expect(execute("eval a b")).to.eql(
          ERROR('wrong # args: should be "eval body"')
        );
      });
      specify("invalid body", () => {
        expect(execute("eval 1")).to.eql(
          ERROR("body must be a script or tuple")
        );
      });
    });
  });
});
