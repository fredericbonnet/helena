import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Scope, initCommands } from "./helena-dialect";
import { Tokenizer } from "../core/tokenizer";
import { INT, NIL, STR } from "../core/values";

describe("Helena dialect", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const prepareScript = (script: string) =>
    rootScope.prepareProcess(rootScope.compile(parse(script)));
  const execute = (script: string) => prepareScript(script).run();
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
      expect(evaluate("() idem val")).to.eql(STR("val"));
      expect(evaluate("(())")).to.eql(NIL);
      expect(evaluate("(()) idem val")).to.eql(STR("val"));
      expect(evaluate("((())) idem val")).to.eql(STR("val"));
    });
    specify("one", () => {
      expect(evaluate("(idem) val")).to.eql(STR("val"));
      expect(evaluate("((idem)) val")).to.eql(STR("val"));
      expect(evaluate("((idem)) val")).to.eql(STR("val"));
      expect(evaluate("(((idem))) val")).to.eql(STR("val"));
    });
    specify("two", () => {
      expect(evaluate("(idem val)")).to.eql(STR("val"));
      expect(evaluate("((idem) val)")).to.eql(STR("val"));
      expect(evaluate("(((idem val)))")).to.eql(STR("val"));
      expect(evaluate("(((idem) val))")).to.eql(STR("val"));
      expect(evaluate("((() idem) val)")).to.eql(STR("val"));
    });
    specify("multiple", () => {
      expect(evaluate("(1)")).to.eql(INT(1));
      expect(evaluate("(+ 1 2)")).to.eql(INT(3));
      expect(evaluate("(+ 1) 2 3")).to.eql(INT(6));
      expect(evaluate("(+ 1 2 3) 4")).to.eql(INT(10));
      expect(evaluate("((+ 1) 2 3) 4 5")).to.eql(INT(15));
    });
    specify("indirect", () => {
      evaluate("let mac [macro {*args} {+ $*args}]");
      evaluate("let sum ([$mac] 1)");
      expect(evaluate("$sum 2 3")).to.eql(INT(6));
    });
    specify("currying", () => {
      evaluate("let double (* 2)");
      evaluate("let quadruple ($double 2)");
      expect(evaluate("$double 5")).to.eql(INT(10));
      expect(evaluate("$quadruple 3")).to.eql(INT(12));
    });
    describe("yield", () => {
      it("should provide a resumable state", () => {
        evaluate("macro cmd {*} {yield val1; idem val2}");
        const process = prepareScript("cmd a b c");

        let result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val1"));

        result = process.run();
        expect(result).to.eql(OK(STR("val2")));
      });
      it("should work on several levels", () => {
        evaluate("macro cmd2 {*} {yield val2}");
        evaluate("macro cmd {*} {yield val1; yield [cmd2]; idem val4}");
        const process = prepareScript("(((cmd) a) b) c");

        let result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val1"));

        result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val2"));

        process.yieldBack(STR("val3"));
        result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val3"));

        result = process.run();
        expect(result).to.eql(OK(STR("val4")));
      });
    });
    specify("error", () => {
      expect(execute("(a)")).to.eql(ERROR('cannot resolve command "a"'));
      expect(execute("() a")).to.eql(ERROR('cannot resolve command "a"'));
      expect(execute("(()) a")).to.eql(ERROR('cannot resolve command "a"'));
      expect(execute("([]) a")).to.eql(ERROR("invalid command name"));
    });
  });

  // TODO example scripts
});
