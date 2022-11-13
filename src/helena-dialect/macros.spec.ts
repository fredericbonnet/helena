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
import { NIL, StringValue } from "../core/values";
import { CommandValue, Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena macros", () => {
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

  describe("macro", () => {
    it("should define a new command", () => {
      evaluate("macro cmd {} {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("macro cmd {} {}");
      expect(execute("macro cmd {} {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("macro {} {}")).to.be.instanceof(CommandValue);
      expect(evaluate("macro cmd {} {}")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [macro {} {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("calls", () => {
      it("should return nil for empty body", () => {
        evaluate("macro cmd {} {}");
        expect(evaluate("cmd")).to.eql(NIL);
      });
      it("should return the result of the last command", () => {
        evaluate("macro cmd {} {idem val1; idem val2}");
        expect(execute("cmd")).to.eql(OK(new StringValue("val2")));
      });
      describe("should evaluate in the caller scope", () => {
        specify("global scope", () => {
          evaluate(
            "macro cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("cmd");
          expect(rootScope.context.constants.get("cst")).to.eql(
            new StringValue("val1")
          );
          expect(rootScope.context.variables.get("var")).to.eql(
            new Variable(new StringValue("val2"))
          );
          expect(rootScope.context.commands.has("cmd2")).to.be.true;
        });
        specify("child scope", () => {
          evaluate(
            "macro cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("scope scp {cmd}");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(rootScope.context.variables.has("var")).to.be.false;
          expect(rootScope.context.commands.has("cmd2")).to.be.false;
          expect(evaluate("scp eval {get cst}")).to.eql(
            new StringValue("val1")
          );
          expect(evaluate("scp eval {get var}")).to.eql(
            new StringValue("val2")
          );
          expect(evaluate("scp eval {cmd2}")).to.eql(new StringValue("val3"));
        });
        specify("scoped macro", () => {
          evaluate(
            "scope scp1 {set cmd [macro {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}]}"
          );
          evaluate("scope scp2 {[scp1 eval {get cmd}] call}");
          expect(execute("scp1 eval {get cst}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp1 eval {get var}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp1 eval {cmd2}").code).to.eql(ResultCode.ERROR);
          expect(evaluate("scp2 eval {get cst}")).to.eql(
            new StringValue("val1")
          );
          expect(evaluate("scp2 eval {get var}")).to.eql(
            new StringValue("val2")
          );
          expect(evaluate("scp2 eval {cmd2}")).to.eql(new StringValue("val3"));
        });
      });
      it("should access scope variables", () => {
        evaluate("set var val");
        evaluate("macro cmd {} {get var}");
        expect(evaluate("cmd")).to.eql(new StringValue("val"));
      });
      it("should set scope variables", () => {
        evaluate("set var old");
        evaluate("macro cmd {} {set var val; set var2 val2}");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(new StringValue("val"));
        expect(evaluate("get var2")).to.eql(new StringValue("val2"));
      });
      it("should access scope commands", () => {
        evaluate("macro cmd2 {} {set var val}");
        evaluate("macro cmd {} {cmd2}");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(new StringValue("val"));
      });
    });
    describe("arguments", () => {
      it("should shadow scope variables", () => {
        evaluate("set var val");
        evaluate("macro cmd {var} {idem $var}");
        expect(evaluate("cmd val2")).to.eql(new StringValue("val2"));
      });
      it("should be macro-local", () => {
        evaluate("set var val");
        evaluate("macro cmd {var} {[macro {} {idem $var}] call}");
        expect(evaluate("cmd val2")).to.eql(new StringValue("val"));
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
          evaluate("macro cmd {a} {}");
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
        it("should interrupt a macro with RETURN code", () => {
          evaluate("macro cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt a macro with RETURN code", () => {
          evaluate("macro cmd {} {tailcall {idem val1}; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
      });
      describe("yield", () => {
        it("should interrupt a macro with YIELD code", () => {
          evaluate("macro cmd {} {yield val1; idem val2}");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("macro cmd {} {idem _[yield val1]_}");
          const state = rootScope.prepareScript(parse("cmd"));

          let result = state.run();
          expect(result.data).to.exist;

          state.yieldBack(new StringValue("val2"));
          result = state.run();
          expect(result).to.eql(OK(new StringValue("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("macro cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("macro cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("macro cmd3 {} {yield val1}");
          evaluate("macro cmd4 {} {yield val3}");
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
        it("should interrupt a macro with ERROR code", () => {
          evaluate("macro cmd {} {error msg; idem val}");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("break", () => {
        it("should interrupt a macro with BREAK code", () => {
          evaluate("macro cmd {} {break; error}");
          expect(execute("cmd")).to.eql(BREAK());
        });
      });
      describe("continue", () => {
        it("should interrupt a macro with CONTINUE code", () => {
          evaluate("macro cmd {} {continue; error}");
          expect(execute("cmd")).to.eql(CONTINUE());
        });
      });
    });
    describe("methods", () => {
      describe("call", () => {
        it("should call macro", () => {
          evaluate("set cmd [macro {} {idem val}]");
          expect(evaluate("$cmd call")).to.eql(new StringValue("val"));
        });
        it("should pass arguments to macro", () => {
          evaluate("set cmd [macro {a} {idem $a}]");
          expect(evaluate("$cmd call val")).to.eql(new StringValue("val"));
        });
      });
      describe("argspec", () => {
        it("should return the macro argspec", () => {
          expect(evaluate("[macro {} {}] argspec")).to.eql(
            evaluate("argspec {}")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[macro {} {}] argspec a")).to.eql(
              ERROR('wrong # args: should be "macro argspec"')
            );
          });
        });
      });
      describe("control flow", () => {
        describe("return", () => {
          it("should interrupt the body with RETURN code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [macro {} {cmd1; return val3; cmd2}]");
            expect(execute("$cmd call")).to.eql(
              RETURN(new StringValue("val3"))
            );
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("tailcall", () => {
          it("should interrupt the body with RETURN code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [macro {} {cmd1; tailcall {idem val3}; cmd2}]");
            expect(execute("$cmd call")).to.eql(
              RETURN(new StringValue("val3"))
            );
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("yield", () => {
          it("should interrupt the body with YIELD code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [macro {} {cmd1; yield; cmd2}]");
            expect(execute("$cmd call").code).to.eql(ResultCode.YIELD);
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            evaluate("set cmd [macro {} {cmd1; cmd2 _[yield val2]_}]");
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
            evaluate("set cmd [macro {} {cmd1; error msg; cmd2}]");
            expect(execute("$cmd call")).to.eql(ERROR("msg"));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("break", () => {
          it("should interrupt the body with BREAK code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [macro {} {cmd1; break; cmd2}]");
            expect(execute("$cmd call")).to.eql(BREAK());
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("continue", () => {
          it("should interrupt the body with CONTINUE code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("set cmd [macro {} {cmd1; continue; cmd2}]");
            expect(execute("$cmd call")).to.eql(CONTINUE());
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[macro {} {}] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("macro")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
        expect(execute("macro a")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
        expect(execute("macro a b c d")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("macro a b")).to.eql(ERROR("body must be a script"));
        expect(execute("macro a b c")).to.eql(ERROR("body must be a script"));
      });
    });
  });
});
