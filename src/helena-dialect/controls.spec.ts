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
import { FALSE, IntegerValue, NIL, StringValue, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { Process } from "../core/compiler";

describe("Helena control flow commands", () => {
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

  describe("while", () => {
    it("should skip the body when test is false", () => {
      expect(execute("while false {error}").code).to.eql(ResultCode.OK);
    });
    it("should loop over the body while test is true", () => {
      evaluate("set i 0; while {$i < 10} {set i [+ $i 1]}");
      expect(evaluate("get i")).to.eql(new IntegerValue(10));
    });
    it("should return the result of the last command", () => {
      expect(execute(" while false {}")).to.eql(OK(NIL));
      expect(
        evaluate("set i 0; while {$i < 10} {set i [+ $i 1]; idem val$i}")
      ).to.eql(new StringValue("val10"));
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt the test with RETURN code", () => {
          expect(execute("while {return val; error} {error}")).to.eql(
            RETURN(new StringValue("val"))
          );
        });
        it("should interrupt the loop with RETURN code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; return val; error}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("yield", () => {
        it("should interrupt the test with YIELD code", () => {
          expect(execute("while {yield; error} {}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should interrupt the body with YIELD code", () => {
          expect(execute("while {true} {yield; error}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should provide a resumable state", () => {
          const process = new Process();
          const program = rootScope.compile(
            parse("while {yield test} {yield body}")
          );

          let result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("test"));
          expect(result.data).to.exist;

          process.result = { ...process.result, value: TRUE };
          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("body"));
          expect(result.data).to.exist;

          process.result = {
            ...process.result,
            value: new StringValue("step 1"),
          };
          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("test"));
          expect(result.data).to.exist;

          process.result = { ...process.result, value: TRUE };
          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("body"));
          expect(result.data).to.exist;

          process.result = {
            ...process.result,
            value: new StringValue("step 2"),
          };
          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("test"));
          expect(result.data).to.exist;

          process.result = { ...process.result, value: FALSE };
          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.OK);
          expect(result.value).to.eql(new StringValue("step 2"));
        });
      });
      describe("error", () => {
        it("should interrupt the test with ERROR code", () => {
          expect(execute("while {error msg; set var val} {error}")).to.eql(
            ERROR("msg")
          );
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
        it("should interrupt the loop with ERROR code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; error msg; set var val}"
            )
          ).to.eql(ERROR("msg"));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
      });
      describe("break", () => {
        it("should interrupt the test with BREAK code", () => {
          expect(execute("while {break; error} {error}")).to.eql(BREAK());
        });
        it("should interrupt the body with nil result", () => {
          expect(
            execute("set i 0; while {$i < 10} {set i [+ $i 1]; break; error}")
          ).to.eql(OK(NIL));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("continue", () => {
        it("should interrupt the test with CONTINUE code", () => {
          expect(execute("while {continue; error} {error}")).to.eql(CONTINUE());
        });
        it("should interrupt the body iteration", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; continue; error}"
            )
          ).to.eql(OK(NIL));
          expect(evaluate("get i")).to.eql(new IntegerValue(10));
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("while a")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
        expect(execute("while a b c")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("while a b")).to.eql(ERROR("body must be a script"));
      });
    });
  });
});
