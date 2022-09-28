import { expect } from "chai";
import { OK, ResultCode, RETURN } from "../core/command";
import { ExecutionContext } from "../core/compiler";
import { CompilingEvaluator, Evaluator } from "../core/evaluator";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue } from "../core/values";
import { CommandValue, Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena closures", () => {
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

  describe("closure", () => {
    it("should define a new command", () => {
      evaluate("closure cmd {} {}");
      expect(rootScope.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("closure cmd {} {}");
      expect(() => evaluate("closure cmd {} {}")).to.not.throw();
    });
    it("should return a command value", () => {
      expect(evaluate("closure {} {}")).to.be.instanceof(CommandValue);
      expect(evaluate("closure cmd {} {}")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [closure {} {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("calls", () => {
      it("should return nil for empty body", () => {
        evaluate("closure cmd {} {}");
        expect(evaluate("cmd")).to.eql(NIL);
      });
      it("should return the result of the last command", () => {
        evaluate("closure cmd {} {idem val1; idem val2}");
        expect(execute("cmd")).to.eql(OK(new StringValue("val2")));
      });
      describe("should evaluate in the parent scope", () => {
        specify("global scope", () => {
          evaluate(
            "closure cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
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
            "closure cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("scope scp {cmd}");
          expect(rootScope.constants.get("cst")).to.eql(
            new StringValue("val1")
          );
          expect(rootScope.variables.get("var")).to.eql(
            new Variable(new StringValue("val2"))
          );
          expect(rootScope.commands.has("cmd2")).to.be.true;
        });
        specify("scoped closure", () => {
          evaluate(
            "scope scp1 {set cmd [closure {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}]}"
          );
          evaluate("scope scp2 {[scp1 eval {get cmd}] call}");
          expect(evaluate("scp1 eval {get cst}")).to.eql(
            new StringValue("val1")
          );
          expect(evaluate("scp1 eval {get var}")).to.eql(
            new StringValue("val2")
          );
          expect(evaluate("scp1 eval {cmd2}")).to.eql(new StringValue("val3"));
          expect(() => evaluate("scp2 eval {get cst}")).to.throw();
          expect(() => evaluate("scp2 eval {get var}")).to.throw();
          expect(() => evaluate("scp2 eval {cmd2}")).to.throw();
        });
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt a closure with RESULT code", () => {
          evaluate("closure cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
      });
      describe("yield", () => {
        it("should interrupt a closure with YIELD code", () => {
          evaluate("closure cmd {} {yield val1; idem val2}");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("closure cmd {} {yield val1; idem val2}");
          const context = new ExecutionContext();
          const program = rootScope.compile(parse("cmd"));

          let result = rootScope.execute(program, context);
          expect(result.state).to.exist;

          result = rootScope.execute(program, context);
          expect(result).to.eql(OK(new StringValue("val2")));
        });
        it("should work recursively", () => {
          evaluate("closure cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("closure cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("closure cmd3 {} {yield val1; idem val2}");
          evaluate("closure cmd4 {} {yield val3; idem val4}");
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
        it("should call closure", () => {
          evaluate("set cmd [closure {} {idem val}]");
          expect(evaluate("$cmd call")).to.eql(new StringValue("val"));
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(() => evaluate("[closure {} {}] unknownMethod")).to.throw(
            'invalid method name "unknownMethod"'
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("closure")).to.throw(
          'wrong # args: should be "closure ?name? args body"'
        );
        expect(() => evaluate("closure a")).to.throw(
          'wrong # args: should be "closure ?name? args body"'
        );
        expect(() => evaluate("closure a b c d")).to.throw(
          'wrong # args: should be "closure ?name? args body"'
        );
      });
    });
  });
});
