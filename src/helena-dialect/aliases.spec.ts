import { expect } from "chai";
import { ERROR, OK, ResultCode, RETURN, YIELD_BACK } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue, TupleValue } from "../core/values";
import { CommandValue, Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { Process } from "../core/compiler";

describe("Helena aliases", () => {
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

  describe("alias", () => {
    it("should define a new command", () => {
      evaluate("alias cmd idem");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("alias cmd set");
      expect(execute("alias cmd idem").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("alias cmd idem")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [alias cmd set]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("calls", () => {
      it("should call the aliased command", () => {
        evaluate("macro mac {} {set var val}");
        evaluate("alias cmd mac");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(new StringValue("val"));
      });
      describe("command tuples", () => {
        specify("zero", () => {
          evaluate("alias cmd ()");
          expect(execute("cmd")).to.eql(OK(NIL));
          expect(execute("cmd idem val")).to.eql(OK(new StringValue("val")));
        });
        specify("one", () => {
          evaluate("alias cmd return");
          expect(execute("cmd")).to.eql(RETURN());
          expect(execute("cmd val")).to.eql(RETURN(new StringValue("val")));
        });
        specify("two", () => {
          evaluate("alias cmd (idem val)");
          expect(execute("cmd")).to.eql(OK(new StringValue("val")));
        });
        specify("three", () => {
          evaluate("alias cmd (set var val)");
          expect(execute("cmd")).to.eql(OK(new StringValue("val")));
          expect(evaluate("get var")).to.eql(new StringValue("val"));
        });
      });
    });
    describe("arguments", () => {
      it("should be passed to aliased commands", () => {
        evaluate("alias cmd (set var)");
        expect(execute("cmd val")).to.eql(OK(new StringValue("val")));
        expect(evaluate("get var")).to.eql(new StringValue("val"));
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
          evaluate("alias cmd (set var)");
          expect(execute("cmd")).to.eql(
            ERROR('wrong # args: should be "set varname value"')
          );
          expect(execute("cmd 1 2")).to.eql(
            ERROR('wrong # args: should be "set varname value"')
          );
        });
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt an alias with RESULT code", () => {
          evaluate("macro mac {} {return val1; idem val2}");
          evaluate("alias cmd mac");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
      });
      describe("yield", () => {
        it("should interrupt a closure with YIELD code", () => {
          evaluate("macro mac {} {yield val1; idem val2}");
          evaluate("alias cmd mac");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("macro mac {} {idem [yield val1]}");
          evaluate("alias cmd mac");
          const process = new Process();
          const program = rootScope.compile(parse("cmd"));

          let result = rootScope.execute(program, process);
          expect(result.data).to.exist;

          process.result = YIELD_BACK(process.result, new StringValue("val2"));
          result = rootScope.execute(program, process);
          expect(result).to.eql(OK(new StringValue("val2")));
        });
      });
    });
    describe("methods", () => {
      describe("call", () => {
        it("should call aliased command", () => {
          evaluate("set cmd [alias cmd (idem val)]");
          expect(evaluate("$cmd call")).to.eql(new StringValue("val"));
        });
        it("should pass arguments to aliased command", () => {
          evaluate("set cmd [alias cmd idem]");
          expect(evaluate("$cmd call val")).to.eql(new StringValue("val"));
        });
        it("should report the original command arity error", () => {
          evaluate("set cmd [alias cmd idem]");
          expect(execute("$cmd call")).to.eql(
            ERROR('wrong # args: should be "idem value"')
          );
        });
      });
      describe("command", () => {
        it("should return the aliased command", () => {
          evaluate("set cmd [alias cmd (idem val)]");
          expect(evaluate("$cmd command")).to.eql(
            new TupleValue([new StringValue("idem"), new StringValue("val")])
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[alias cmd set] command a")).to.eql(
              ERROR('wrong # args: should be "alias command"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[alias cmd idem] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("alias a")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
        expect(execute("alias a b c")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
      });
    });
  });
});
