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
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena closures", () => {
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

  describe("closure", () => {
    it("should define a new command", () => {
      evaluate("closure cmd {} {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("closure cmd {} {}");
      expect(execute("closure cmd {} {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("closure {} {}").type).to.eql(commandValueType);
      expect(evaluate("closure cmd {} {}").type).to.eql(commandValueType);
    });
    specify("command value should return closure command", () => {
      const value = evaluate("set cmd [closure {val} {idem _${val}_}]");
      expect(evaluate("$cmd").type).to.eql(commandValueType);
      expect(evaluate("$cmd")).to.not.eql(value);
      expect(evaluate("[$cmd] arg")).to.eql(new StringValue("_arg_"));
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
          expect(rootScope.context.constants.get("cst")).to.eql(
            new StringValue("val1")
          );
          expect(rootScope.context.variables.get("var")).to.eql(
            new StringValue("val2")
          );
          expect(rootScope.context.commands.has("cmd2")).to.be.true;
        });
        specify("child scope", () => {
          evaluate(
            "closure cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("scope scp {cmd}");
          expect(rootScope.context.constants.get("cst")).to.eql(
            new StringValue("val1")
          );
          expect(rootScope.context.variables.get("var")).to.eql(
            new StringValue("val2")
          );
          expect(rootScope.context.commands.has("cmd2")).to.be.true;
        });
        specify("scoped closure", () => {
          evaluate(
            "scope scp1 {set cmd [closure {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}]}"
          );
          evaluate("scope scp2 {[[scp1 eval {get cmd}]]}");
          expect(evaluate("scp1 eval {get cst}")).to.eql(
            new StringValue("val1")
          );
          expect(evaluate("scp1 eval {get var}")).to.eql(
            new StringValue("val2")
          );
          expect(evaluate("scp1 eval {cmd2}")).to.eql(new StringValue("val3"));
          expect(execute("scp2 eval {get cst}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp2 eval {get var}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp2 eval {cmd2}").code).to.eql(ResultCode.ERROR);
        });
      });
    });
    describe("arguments", () => {
      it("should shadow scope variables", () => {
        evaluate("set var val");
        evaluate("closure cmd {var} {idem $var}");
        expect(evaluate("cmd val2")).to.eql(new StringValue("val2"));
      });
      it("should be closure-local", () => {
        evaluate("set var val");
        evaluate("closure cmd {var} {[[closure {} {idem $var}]]}");
        expect(evaluate("cmd val2")).to.eql(new StringValue("val"));
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
          evaluate("closure cmd {a} {}");
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
        it("should interrupt a closure with RETURN code", () => {
          evaluate("closure cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt a closure with RETURN code", () => {
          evaluate("closure cmd {} {tailcall (idem val1); idem val2}");
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
          evaluate("closure cmd {} {idem _[yield val1]_}");
          const process = rootScope.prepareScript(parse("cmd"));

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));

          process.yieldBack(new StringValue("val2"));
          result = process.run();
          expect(result).to.eql(OK(new StringValue("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("closure cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("closure cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("closure cmd3 {} {yield val1}");
          evaluate("closure cmd4 {} {yield val3}");
          const process = rootScope.prepareScript(parse("cmd1"));

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));

          process.yieldBack(new StringValue("val2"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));

          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val3"));

          process.yieldBack(new StringValue("val4"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val4"));

          result = process.run();
          expect(result).to.eql(OK(new StringValue("val5")));
        });
      });
      describe("error", () => {
        it("should interrupt a closure with ERROR code", () => {
          evaluate("closure cmd {} {error msg; idem val}");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("break", () => {
        it("should interrupt a closure with BREAK code", () => {
          evaluate("closure cmd {} {break; idem val}");
          expect(execute("cmd")).to.eql(BREAK());
        });
      });
      describe("continue", () => {
        it("should interrupt a closure with CONTINUE code", () => {
          evaluate("closure cmd {} {continue; idem val}");
          expect(execute("cmd")).to.eql(CONTINUE());
        });
      });
    });
    describe("methods", () => {
      describe("argspec", () => {
        it("should return the closure argspec", () => {
          expect(evaluate("[closure {a b} {}] argspec")).to.eql(
            evaluate("argspec {a b}")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[closure {} {}] argspec a")).to.eql(
              ERROR('wrong # args: should be "closure argspec"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[closure {} {}] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("closure")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
        expect(execute("closure a")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
        expect(execute("closure a b c d")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("closure a b")).to.eql(ERROR("body must be a script"));
        expect(execute("closure a b c")).to.eql(ERROR("body must be a script"));
      });
      specify("command name with no string representation", () => {
        expect(execute("closure [] {} {}")).to.eql(
          ERROR("command name has no string representation")
        );
      });
    });
  });
});
