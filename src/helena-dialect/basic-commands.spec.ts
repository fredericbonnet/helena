import { expect } from "chai";
import { ERROR, OK, ResultCode, RETURN } from "../core/results";
import { Process } from "../core/compiler";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue, TupleValue } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena basic commands", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) =>
    rootScope.execute(rootScope.compile(parse(script)));
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
      describe("yield", () => {
        it("should interrupt the body with YIELD code", () => {
          expect(
            execute("eval {set var val1; yield; set var val2}").code
          ).to.eql(ResultCode.YIELD);
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          const process = new Process();
          const program = rootScope.compile(
            parse("eval {set var val1; yield val2; set var val3}")
          );

          let result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));
          expect(result.data).to.exist;
          expect(evaluate("get var")).to.eql(new StringValue("val1"));

          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.OK);
          expect(result.value).to.eql(new StringValue("val3"));
          expect(evaluate("get var")).to.eql(new StringValue("val3"));
        });
      });
      it("should work recursively", () => {
        const process = new Process();
        const program = rootScope.compile(
          parse("eval {eval {yield val1}; yield val2; eval {yield val3}}")
        );

        let result = rootScope.execute(program, process);
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(new StringValue("val1"));
        expect(result.data).to.exist;

        result = rootScope.execute(program, process);
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(new StringValue("val2"));
        expect(result.data).to.exist;

        result = rootScope.execute(program, process);
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(new StringValue("val3"));
        expect(result.data).to.exist;

        result = rootScope.execute(program, process);
        expect(result.code).to.eql(ResultCode.OK);
        expect(result.value).to.eql(new StringValue("val3"));
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
      specify("non-script body", () => {
        expect(execute("eval 1")).to.eql(ERROR("body must be a script"));
      });
    });
  });
});
