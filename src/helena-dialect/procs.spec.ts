import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue } from "../core/values";
import { CommandValue, Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena procedures", () => {
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

  describe("proc", () => {
    it("should define a new command", () => {
      evaluate("proc cmd {} {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("proc cmd {} {}");
      expect(execute("proc cmd {} {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("proc {} {}")).to.be.instanceof(CommandValue);
      expect(evaluate("proc cmd {} {}")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [proc {} {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("calls", () => {
      it("should return nil for empty body", () => {
        evaluate("proc cmd {} {}");
        expect(evaluate("cmd")).to.eql(NIL);
      });
      it("should return the result of the last command", () => {
        evaluate("proc cmd {} {idem val1; idem val2}");
        expect(execute("cmd")).to.eql(OK(new StringValue("val2")));
      });
      it("should evaluate in their own scope", () => {
        evaluate(
          "proc cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}; set var [cmd2]}"
        );
        expect(execute("cmd")).to.eql(OK(new StringValue("val3")));
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(rootScope.context.variables.has("var")).to.be.false;
        expect(rootScope.context.commands.has("cmd2")).to.be.false;
      });
      it("should access external commands", () => {
        evaluate("proc cmd {} {idem val}");
        expect(evaluate("cmd")).to.eql(new StringValue("val"));
      });
      it("should not access external variables", () => {
        evaluate("set var val");
        evaluate("proc cmd {} {get var}");
        expect(execute("cmd").code).to.eql(ResultCode.ERROR);
      });
      it("should not set external variables", () => {
        evaluate("set var val");
        evaluate("proc cmd {} {set var val2; let cst val3}");
        evaluate("cmd");
        expect(rootScope.context.variables.get("var")).to.eql(
          new Variable(new StringValue("val"))
        );
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      specify("local commands should shadow external commands", () => {
        evaluate("macro mac {} {idem val}");
        evaluate("proc cmd {} {macro mac {} {idem val2}; mac}");
        expect(evaluate("cmd")).to.eql(new StringValue("val2"));
      });
    });
    describe("arguments", () => {
      it("should be scope variables", () => {
        evaluate("set var val");
        evaluate("proc cmd {var} {macro cmd2 {} {set var _$var}; cmd2}");
        expect(evaluate("cmd val2")).to.eql(new StringValue("_val2"));
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
          evaluate("proc cmd {a} {}");
          expect(execute("cmd")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("cmd 1 2")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
        });
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt a proc with OK code", () => {
          evaluate("proc cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(OK(new StringValue("val1")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt a proc with OK code", () => {
          evaluate("proc cmd {} {tailcall (idem val1); idem val2}");
          expect(execute("cmd")).to.eql(OK(new StringValue("val1")));
        });
      });
      describe("yield", () => {
        it("should interrupt a proc with YIELD code", () => {
          evaluate("proc cmd {} {yield val1; idem val2}");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("proc cmd {} {idem _[yield val1]_}");
          const state = rootScope.prepareScript(parse("cmd"));

          let result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
          expect(result.data).to.exist;

          state.yieldBack(new StringValue("val2"));
          result = state.run();
          expect(result).to.eql(OK(new StringValue("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("proc cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("proc cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("proc cmd3 {} {yield val1}");
          evaluate("proc cmd4 {} {yield val3}");
          const state = rootScope.prepareScript(parse("cmd1"));

          let result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));

          state.yieldBack(new StringValue("val2"));
          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));

          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val3"));

          state.yieldBack(new StringValue("val4"));
          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val4"));

          result = state.run();
          expect(result).to.eql(OK(new StringValue("val5")));
        });
      });
      describe("error", () => {
        it("should interrupt a proc with ERROR code", () => {
          evaluate("proc cmd {} {error msg; idem val}");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("break", () => {
        it("should interrupt a proc with ERROR code", () => {
          evaluate("proc cmd {} {break; idem val}");
          expect(execute("cmd")).to.eql(ERROR("unexpected break"));
        });
      });
      describe("continue", () => {
        it("should interrupt a proc with ERROR code", () => {
          evaluate("proc cmd {} {continue; idem val}");
          expect(execute("cmd")).to.eql(ERROR("unexpected continue"));
        });
      });
    });
    describe("methods", () => {
      describe("call", () => {
        it("should call proc", () => {
          evaluate("set cmd [proc {} {idem val}]");
          expect(evaluate("$cmd call")).to.eql(new StringValue("val"));
        });
        it("should pass arguments to proc", () => {
          evaluate("set cmd [proc {a} {idem $a}]");
          expect(evaluate("$cmd call val")).to.eql(new StringValue("val"));
        });
      });
      describe("argspec", () => {
        it("should return the proc argspec", () => {
          expect(evaluate("[proc {} {}] argspec")).to.eql(
            evaluate("argspec {}")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[proc {} {}] argspec a")).to.eql(
              ERROR('wrong # args: should be "proc argspec"')
            );
          });
        });
      });
      describe("control flow", () => {
        describe("return", () => {
          it("should interrupt the body with OK code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [proc {} {cmd1; return val3; cmd2}]");
            expect(execute("$cmd call")).to.eql(OK(new StringValue("val3")));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("tailcall", () => {
          it("should interrupt the body with OK code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [proc {} {cmd1; tailcall {idem val3}; cmd2}]");
            expect(execute("$cmd call")).to.eql(OK(new StringValue("val3")));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("yield", () => {
          it("should interrupt the body with YIELD code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [proc {} {cmd1; yield; cmd2}]");
            expect(execute("$cmd call").code).to.eql(ResultCode.YIELD);
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            evaluate("set cmd [proc {} {cmd1; cmd2 _[yield val2]_}]");
            const state = rootScope.prepareScript(parse("$cmd call"));

            let result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("val2"));
            expect(result.data).to.exist;

            state.yieldBack(new StringValue("val3"));
            result = state.run();
            expect(result).to.eql(OK(new StringValue("_val3_")));
            expect(evaluate("get var")).to.eql(new StringValue("_val3_"));
          });
        });
        describe("error", () => {
          it("should interrupt the body with ERROR code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [proc {} {cmd1; error msg; cmd2}]");
            expect(execute("$cmd call")).to.eql(ERROR("msg"));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("break", () => {
          it("should interrupt the body with ERROR code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [proc {} {cmd1; break; cmd2}]");
            expect(execute("$cmd call")).to.eql(ERROR("unexpected break"));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("continue", () => {
          it("should interrupt the body with CONTINUE code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [proc {} {cmd1; continue; cmd2}]");
            expect(execute("$cmd call")).to.eql(ERROR("unexpected continue"));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[proc {} {}] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("proc")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
        expect(execute("proc a")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
        expect(execute("proc a b c d")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("proc a b")).to.eql(ERROR("body must be a script"));
        expect(execute("proc a b c")).to.eql(ERROR("body must be a script"));
      });
    });
  });
});
