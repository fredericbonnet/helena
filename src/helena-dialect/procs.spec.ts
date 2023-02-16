import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue } from "../core/values";
import { commandValueType, Scope } from "./core";
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
      expect(evaluate("proc {} {}").type).to.eql(commandValueType);
      expect(evaluate("proc cmd {} {}").type).to.eql(commandValueType);
    });
    specify("command value should return proc command", () => {
      const value = evaluate("set cmd [proc {val} {idem _${val}_}]");
      expect(evaluate("$cmd").type).to.eql(commandValueType);
      expect(evaluate("$cmd")).to.not.eql(value);
      expect(evaluate("[$cmd] arg")).to.eql(new StringValue("_arg_"));
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
      it("should evaluate from their parent scope", () => {
        evaluate("closure cls {} {set var val}");
        evaluate("proc cmd {} {cls}");
        expect(
          evaluate("[scope {closure cls {} {set var val2}}] eval {cmd}")
        ).to.eql(new StringValue("val"));
        expect(evaluate("get var")).to.eql(new StringValue("val"));
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
          new StringValue("val")
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
          expect(execute("[[proc {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<proc> a"')
          );
          expect(execute("[[proc cmd {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<proc> a"')
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
          const process = rootScope.prepareScript(parse("cmd"));

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
          expect(result.data).to.exist;

          process.yieldBack(new StringValue("val2"));
          result = process.run();
          expect(result).to.eql(OK(new StringValue("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("proc cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("proc cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("proc cmd3 {} {yield val1}");
          evaluate("proc cmd4 {} {yield val3}");
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
      describe("argspec", () => {
        it("should return the proc argspec", () => {
          expect(evaluate("[proc {a b} {}] argspec")).to.eql(
            evaluate("argspec {a b}")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[proc {} {}] argspec a")).to.eql(
              ERROR('wrong # args: should be "<proc> argspec"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[proc {} {}] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
        specify("invalid method name", () => {
          expect(execute("[proc {} {}] []")).to.eql(
            ERROR("invalid method name")
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
      specify("invalid command name", () => {
        expect(execute("proc [] {} {}")).to.eql(ERROR("invalid command name"));
      });
    });
  });
});
