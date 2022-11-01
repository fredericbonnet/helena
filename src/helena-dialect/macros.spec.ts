import { expect } from "chai";
import { ERROR, OK, ResultCode, RETURN } from "../core/results";
import { Process } from "../core/compiler";
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
  const execute = (script: string) =>
    rootScope.execute(rootScope.compile(parse(script)));
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
        it("should interrupt a macro with RESULT code", () => {
          evaluate("macro cmd {} {return val1; idem val2}");
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
          evaluate("macro cmd {} {yield val1; idem val2}");
          const process = new Process();
          const program = rootScope.compile(parse("cmd"));

          let result = rootScope.execute(program, process);
          expect(result.data).to.exist;

          result = rootScope.execute(program, process);
          expect(result).to.eql(OK(new StringValue("val2")));
        });
        it("should work recursively", () => {
          evaluate("macro cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("macro cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("macro cmd3 {} {yield val1; idem val2}");
          evaluate("macro cmd4 {} {yield val3; idem val4}");
          const process = new Process();
          const program = rootScope.compile(parse("cmd1"));

          let result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));

          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));

          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val3"));

          result = rootScope.execute(program, process);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val4"));

          result = rootScope.execute(program, process);
          expect(result).to.eql(OK(new StringValue("val5")));
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
    });
  });
});
