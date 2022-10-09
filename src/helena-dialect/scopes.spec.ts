import { expect } from "chai";
import { OK, ResultCode } from "../core/command";
import { ExecutionContext } from "../core/compiler";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { StringValue } from "../core/values";
import { CommandValue, Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena scopes", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) =>
    rootScope.execute(rootScope.compile(parse(script)));
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
  });

  describe("scope", () => {
    it("should define a new command", () => {
      evaluate("scope cmd {}");
      expect(rootScope.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("scope cmd {}");
      expect(() => evaluate("scope cmd {}")).to.not.throw();
    });
    it("should return a command value", () => {
      expect(evaluate("scope {}")).to.be.instanceof(CommandValue);
      expect(evaluate("scope cmd  {}")).to.be.instanceof(CommandValue);
    });
    specify("command should return self", () => {
      const value = evaluate("scope cmd {}");
      expect(evaluate("cmd")).to.eql(value);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [scope {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("body", () => {
      it("should be executed", () => {
        evaluate("closure cmd {} {let var val}");
        expect(rootScope.constants.has("var")).to.be.false;
        evaluate("scope {cmd}");
        expect(rootScope.constants.get("var")).to.eql(new StringValue("val"));
      });
      it("should access global commands", () => {
        expect(() => evaluate("scope {idem val}")).to.not.throw();
      });
      it("should not access global variables", () => {
        evaluate("set var val");
        expect(() => evaluate("scope {get var}")).to.throw();
      });
      it("should not set global variables", () => {
        evaluate("set var val");
        evaluate("scope {set var val2; let cst val3}");
        expect(rootScope.variables.get("var")).to.eql(
          new Variable(new StringValue("val"))
        );
        expect(rootScope.constants.has("cst")).to.be.false;
      });
      it("should set scope variables", () => {
        evaluate("set var val");
        evaluate("scope cmd {set var val2; let cst val3}");
        expect(rootScope.variables.get("var")).to.eql(
          new Variable(new StringValue("val"))
        );
        expect(rootScope.constants.has("cst")).to.be.false;
        expect(evaluate("cmd eval {get var}")).to.eql(new StringValue("val2"));
        expect(evaluate("cmd eval {get cst}")).to.eql(new StringValue("val3"));
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt the body with OK code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("scope {cmd1; return; cmd2}").code).to.eql(
            ResultCode.OK
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should still define the scope command", () => {
          evaluate("scope cmd {return}");
          expect(rootScope.commands.has("cmd")).to.be.true;
        });
        it("should return passed value instead of scope command value", () => {
          expect(execute("scope {return val}")).to.eql(
            OK(new StringValue("val"))
          );
        });
      });
      describe("yield", () => {
        it("should interrupt the body with YIELD code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("scope cmd {cmd1; yield; cmd2}").code).to.eql(
            ResultCode.YIELD
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          const context = new ExecutionContext();
          const program = rootScope.compile(
            parse("scope cmd {cmd1; yield val3; cmd2}")
          );

          let result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val3"));
          expect(result.state).to.exist;

          result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.OK);
          expect(result.value).to.be.instanceof(CommandValue);
          expect(evaluate("get var")).to.eql(new StringValue("val2"));
        });
        it("should delay the definition of scope command until resumed", () => {
          const context = new ExecutionContext();
          const program = rootScope.compile(parse("scope cmd {yield}"));

          let result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(rootScope.commands.has("cmd")).to.be.false;

          result = rootScope.execute(program, context);
          expect(result.code).to.eql(ResultCode.OK);
          expect(rootScope.commands.has("cmd")).to.be.true;
        });
      });
    });
    describe("methods", () => {
      describe("eval", () => {
        it("should evaluate body", () => {
          evaluate("scope cmd {let cst val}");
          expect(evaluate("cmd eval {get cst}")).to.eql(new StringValue("val"));
        });
        it("should evaluate macros in scope", () => {
          evaluate("scope cmd {macro mac {} {let cst val}}");
          evaluate("cmd eval {mac}");
          expect(rootScope.constants.has("cst")).to.be.false;
          expect(evaluate("cmd eval {get cst}")).to.eql(new StringValue("val"));
        });
        it("should evaluate closures in their scope", () => {
          evaluate("closure cls {} {let cst val}");
          evaluate("scope cmd {}");
          evaluate("cmd eval {cls}");
          expect(rootScope.constants.get("cst")).to.eql(new StringValue("val"));
          expect(() => evaluate("cmd eval {get cst}")).to.throw();
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[scope {}] eval")).to.throw(
              'wrong # args: should be "scope eval body'
            );
            expect(() => evaluate("[scope {}] eval a b")).to.throw(
              'wrong # args: should be "scope eval body'
            );
          });
        });
      });
      describe("call", () => {
        it("should call scope commands", () => {
          evaluate("scope cmd {macro mac {} {idem val}}");
          expect(evaluate("cmd call mac")).to.eql(new StringValue("val"));
        });
        it("should evaluate macros in scope", () => {
          evaluate("scope cmd {macro mac {} {let cst val}}");
          evaluate("cmd call mac");
          expect(rootScope.constants.has("cst")).to.be.false;
          expect(evaluate("cmd eval {get cst}")).to.eql(new StringValue("val"));
        });
        it("should evaluate closures in scope", () => {
          evaluate("scope cmd {closure cls {} {let cst val}}");
          evaluate("cmd call cls");
          expect(rootScope.constants.has("cst")).to.be.false;
          expect(evaluate("cmd eval {get cst}")).to.eql(new StringValue("val"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("[scope {}] call")).to.throw(
              'wrong # args: should be "scope call cmdname ?arg ...?"'
            );
          });
          specify("non-existing command", () => {
            expect(() => evaluate("[scope {}] call unknownCommand")).to.throw(
              'invalid command name "unknownCommand"'
            );
          });
          specify("out-of-scope command", () => {
            expect(() =>
              evaluate("macro cmd {} {}; [scope {}] call cmd")
            ).to.throw('invalid command name "cmd"');
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(() => evaluate("[scope {}] unknownMethod")).to.throw(
            'invalid method name "unknownMethod"'
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(() => evaluate("scope")).to.throw(
          'wrong # args: should be "scope ?name? body"'
        );
        expect(() => evaluate("scope a b c")).to.throw(
          'wrong # args: should be "scope ?name? body"'
        );
      });
    });
  });
});
