import { expect } from "chai";
import { OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Scope, initCommands } from "./helena-dialect";
import { Tokenizer } from "../core/tokenizer";
import { IntegerValue, NIL, StringValue } from "../core/values";

describe("Helena dialect", () => {
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

  describe("leading tuple auto-expansion", () => {
    specify("zero", () => {
      expect(evaluate("()")).to.eql(NIL);
      expect(evaluate("() idem val")).to.eql(new StringValue("val"));
      expect(evaluate("(())")).to.eql(NIL);
      expect(evaluate("(()) idem val")).to.eql(new StringValue("val"));
      expect(evaluate("((())) idem val")).to.eql(new StringValue("val"));
    });
    specify("one", () => {
      expect(evaluate("(idem) val")).to.eql(new StringValue("val"));
      expect(evaluate("((idem)) val")).to.eql(new StringValue("val"));
      expect(evaluate("((idem)) val")).to.eql(new StringValue("val"));
      expect(evaluate("(((idem))) val")).to.eql(new StringValue("val"));
    });
    specify("two", () => {
      expect(evaluate("(idem val)")).to.eql(new StringValue("val"));
      expect(evaluate("((idem) val)")).to.eql(new StringValue("val"));
      expect(evaluate("(((idem val)))")).to.eql(new StringValue("val"));
      expect(evaluate("(((idem) val))")).to.eql(new StringValue("val"));
      expect(evaluate("((() idem) val)")).to.eql(new StringValue("val"));
    });
    specify("multiple", () => {
      expect(evaluate("(1)")).to.eql(new IntegerValue(1));
      expect(evaluate("(+ 1 2)")).to.eql(new IntegerValue(3));
      expect(evaluate("(+ 1) 2 3")).to.eql(new IntegerValue(6));
      expect(evaluate("(+ 1 2 3) 4")).to.eql(new IntegerValue(10));
      expect(evaluate("((+ 1) 2 3) 4 5")).to.eql(new IntegerValue(15));
    });
    specify("indirect", () => {
      evaluate("let mac [macro {*args} {+ $*args}]");
      evaluate("let sum ($mac call)");
      expect(evaluate("$sum 1 2 3")).to.eql(new IntegerValue(6));
    });
    specify("currying", () => {
      evaluate("let double (* 2)");
      evaluate("let quadruple ($double 2)");
      expect(evaluate("$double 5")).to.eql(new IntegerValue(10));
      expect(evaluate("$quadruple 3")).to.eql(new IntegerValue(12));
    });
    describe("yield", () => {
      it("should provide a resumable state", () => {
        evaluate("macro cmd {*} {yield val1; idem val2}");
        const state = rootScope.prepareScript(parse("cmd a b c"));

        let result = state.run();
        expect(result.data).to.exist;

        result = state.run();
        expect(result).to.eql(OK(new StringValue("val2")));
      });
      it("should work on several levels", () => {
        evaluate("macro cmd2 {*} {yield val2}");
        evaluate("macro cmd {*} {yield val1; yield [cmd2]; idem val4}");
        const state = rootScope.prepareScript(parse("(((cmd) a) b) c"));

        let result = state.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(new StringValue("val1"));

        result = state.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(new StringValue("val2"));

        state.yieldBack(new StringValue("val3"));
        result = state.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(new StringValue("val3"));

        result = state.run();
        expect(result.code).to.eql(ResultCode.OK);
        expect(result.value).to.eql(new StringValue("val4"));
      });
    });
  });

  // TODO example scripts
});
