import { expect } from "chai";
import { OK, ResultCode, RETURN } from "../core/command";
import { ExecutionContext } from "../core/compiler";
import { CompilingEvaluator, Evaluator } from "../core/evaluator";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue } from "../core/values";
import { CommandValue, Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena macros", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;
  let evaluator: Evaluator;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) => evaluator.executeScript(parse(script));
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
    evaluator = new CompilingEvaluator(
      rootScope.variableResolver,
      rootScope.commandResolver,
      null
    );
  });

  describe("macro", () => {
    it("should define a new command", () => {
      evaluate("macro cmd {} {}");
      expect(rootScope.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("macro cmd {} {}");
      expect(() => evaluate("macro cmd {} {}")).to.not.throw();
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
          expect(rootScope.constants.get("cst")).to.eql(
            new StringValue("val1")
          );
          expect(rootScope.variables.get("var")).to.eql(
            new Variable(new StringValue("val2"))
          );
          expect(rootScope.commands.has("cmd2")).to.be.true;
        });
        specify("child scope", () => {
          evaluate(
            "macro cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("scope scp {cmd}");
          expect(rootScope.constants.has("cst")).to.be.false;
          expect(rootScope.variables.has("var")).to.be.false;
          expect(rootScope.commands.has("cmd2")).to.be.false;
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
          expect(() => evaluate("scp1 eval {get cst}")).to.throw();
          expect(() => evaluate("scp1 eval {get var}")).to.throw();
          expect(() => evaluate("scp1 eval {cmd2}")).to.throw();
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
          const context = new ExecutionContext();
          const program = rootScope.compile(parse("cmd"));

          let result = rootScope.execute(program, context);
          expect(result.state).to.exist;

          result = rootScope.execute(program, context);
          expect(result).to.eql(OK(new StringValue("val2")));
        });
        it("should work recursively", () => {
          evaluate("macro cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("macro cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("macro cmd3 {} {yield val1; idem val2}");
          evaluate("macro cmd4 {} {yield val3; idem val4}");
          const context = new ExecutionContext();
          const program = rootScope.compile(parse("cmd1"));

          let result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));

          result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));

          result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val3"));

          result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val4"));

          result = rootScope.execute(program, context);
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
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(() => evaluate("[macro {} {}] unknownMethod")).to.throw(
            'invalid method name "unknownMethod"'
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("macro")).to.throw(
          'wrong # args: should be "macro ?name? args body"'
        );
        expect(() => evaluate("macro a")).to.throw(
          'wrong # args: should be "macro ?name? args body"'
        );
        expect(() => evaluate("macro a b c d")).to.throw(
          'wrong # args: should be "macro ?name? args body"'
        );
      });
    });
  });
});
