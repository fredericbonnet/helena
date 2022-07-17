import { expect } from "chai";
import { CompilingEvaluator, Evaluator, InlineEvaluator } from "./evaluator";
import { Parser } from "./parser";
import { TclScope, initTclCommands } from "./tcl-dialect";
import { Tokenizer } from "./tokenizer";
import { StringValue, TupleValue } from "./values";

describe("Tcl dialect", () => {
  for (let klass of [InlineEvaluator, CompilingEvaluator]) {
    describe(klass.name, () => {
      let rootScope: TclScope;

      let tokenizer: Tokenizer;
      let parser: Parser;
      let evaluator: Evaluator;

      const parse = (script: string) =>
        parser.parse(tokenizer.tokenize(script));
      const evaluate = (script: string) =>
        evaluator.executeScript(parse(script))[1];

      beforeEach(() => {
        rootScope = new TclScope();
        initTclCommands(rootScope);

        tokenizer = new Tokenizer();
        parser = new Parser();
        evaluator = new klass(
          rootScope.variableResolver,
          rootScope.commandResolver,
          null
        );
      });

      describe("if", () => {
        it("should evaluate the if branch when expression is true", () => {
          expect(evaluate("if 1 {set var if}")).to.eql(new StringValue("if"));
        });
        it("should evaluate the else branch when expression is false", () => {
          expect(evaluate("if 0 {set var if} else {set var else}")).to.eql(
            new StringValue("else")
          );
        });
        it("should return empty when expression is false and there is no else branch", () => {
          expect(evaluate("if 0 {set var if}")).to.eql(new StringValue(""));
        });
        it("should propagate return", () => {
          evaluate(
            "proc cmd {expr} {if $expr {return if} else {return else}; set var val}"
          );
          expect(evaluate("cmd 0")).to.eql(new StringValue("else"));
          expect(evaluate("cmd 1")).to.eql(new StringValue("if"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("if")).to.throw(
              'wrong # args: should be "if test script1 ?else script2?"'
            );
            expect(() => evaluate("if true")).to.throw(
              'wrong # args: should be "if test script1 ?else script2?"'
            );
            expect(() => evaluate("if true {} else")).to.throw(
              'wrong # args: should be "if test script1 ?else script2?"'
            );
            expect(() => evaluate("if true {} else {} {}")).to.throw(
              'wrong # args: should be "if test script1 ?else script2?"'
            );
          });
          specify("invalid expression", () => {
            expect(() => evaluate("if a {}")).to.throw(
              'expected integer but got "a"'
            );
          });
        });
      });

      describe("set", () => {
        it("should return the value of an existing variable", () => {
          rootScope.variables.set("var", new StringValue("val"));
          expect(evaluate("set var")).to.eql(new StringValue("val"));
        });
        it("should set the value of a new variable", () => {
          evaluate("set var val");
          expect(rootScope.variables.get("var")).to.eql(new StringValue("val"));
        });
        it("should overwrite the value of an existing variable", () => {
          rootScope.variables.set("var", new StringValue("old"));
          evaluate("set var val");
          expect(rootScope.variables.get("var")).to.eql(new StringValue("val"));
        });
        it("should return the set value", () => {
          expect(evaluate("set var val")).to.eql(new StringValue("val"));
        });
        describe("exceptions", () => {
          specify("non-existing variable", () => {
            expect(() => evaluate("set unknownVariable")).to.throw(
              'can\'t read "unknownVariable": no such variable'
            );
          });
          specify("wrong arity", () => {
            expect(() => evaluate("set")).to.throw(
              'wrong # args: should be "set varName ?newValue?"'
            );
            expect(() => evaluate("set a b c")).to.throw(
              'wrong # args: should be "set varName ?newValue?"'
            );
          });
        });
      });

      describe("proc", () => {
        it("should define a new command", () => {
          evaluate("proc cmd {} {}");
          expect(rootScope.commands.has("cmd"));
        });
        it("should replace existing commands", () => {
          evaluate("proc cmd {} {}");
          evaluate("proc cmd {} {}");
          expect(() => evaluate("proc cmd {} {}")).to.not.throw();
        });
        it("should return empty", () => {
          expect(evaluate("proc cmd {} {}")).to.eql(new StringValue(""));
        });
        describe("calls", () => {
          it("should return empty string for empty body", () => {
            evaluate("proc cmd {} {}");
            expect(evaluate("cmd")).to.eql(new StringValue(""));
          });
          it("should return the result of the last command", () => {
            evaluate("proc cmd {} {set var val}");
            expect(evaluate("cmd")).to.eql(new StringValue("val"));
          });
          it("should access global commands", () => {
            evaluate("proc cmd2 {} {set var val}");
            evaluate("proc cmd {} {cmd2}");
            expect(evaluate("cmd")).to.eql(new StringValue("val"));
          });
          it("should not access global variables", () => {
            evaluate("set var val");
            evaluate("proc cmd {} {set var}");
            expect(() => evaluate("cmd")).to.throw();
          });
          it("should not set global variables", () => {
            evaluate("set var val");
            evaluate("proc cmd {} {set var val2}");
            evaluate("cmd");
            expect(rootScope.variables.get("var")).to.eql(
              new StringValue("val")
            );
          });
          it("should set local variables", () => {
            evaluate("set var val");
            evaluate("proc cmd {} {set var2 val}");
            evaluate("cmd");
            expect(!rootScope.variables.has("var2"));
          });
          it("should map arguments to local variables", () => {
            evaluate("proc cmd {param} {set param}");
            expect(evaluate("cmd arg")).to.eql(new StringValue("arg"));
            expect(!rootScope.variables.has("param"));
          });
          it("should accept default argument values", () => {
            evaluate(
              "proc cmd {param1 {param2 def}} {set var ($param1 $param2)}"
            );
            expect(evaluate("cmd arg")).to.eql(
              new TupleValue([new StringValue("arg"), new StringValue("def")])
            );
          });
          it("should accept remaining args", () => {
            evaluate("proc cmd {param1 param2 args} {set var $args}");
            expect(evaluate("cmd 1 2")).to.eql(new TupleValue([]));
            expect(evaluate("cmd 1 2 3 4")).to.eql(
              new TupleValue([new StringValue("3"), new StringValue("4")])
            );
          });
          it("should accept both default and remaining args", () => {
            evaluate(
              "proc cmd {param1 {param2 def} args} {set var ($param1 $param2 $*args)}"
            );
            expect(evaluate("cmd 1 2")).to.eql(
              new TupleValue([new StringValue("1"), new StringValue("2")])
            );
            expect(evaluate("cmd 1 2 3 4")).to.eql(
              new TupleValue([
                new StringValue("1"),
                new StringValue("2"),
                new StringValue("3"),
                new StringValue("4"),
              ])
            );
          });
          describe("exceptions", () => {
            specify("not enough arguments", () => {
              expect(() => evaluate("proc cmd {a b} {}; cmd 1")).to.throw(
                'wrong # args: should be "cmd a b"'
              );
              expect(() => evaluate("proc cmd {a b args} {}; cmd 1")).to.throw(
                'wrong # args: should be "cmd a b ?arg ...?"'
              );
            });
            specify("too many arguments", () => {
              expect(() => evaluate("proc cmd {} {}; cmd 1 2")).to.throw(
                'wrong # args: should be "cmd"'
              );
              expect(() => evaluate("proc cmd {a} {}; cmd 1 2")).to.throw(
                'wrong # args: should be "cmd a"'
              );
              expect(() =>
                evaluate("proc cmd {a {b 1}} {}; cmd 1 2 3")
              ).to.throw('wrong # args: should be "cmd a ?b?"');
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("proc")).to.throw(
              'wrong # args: should be "proc name args body"'
            );
            expect(() => evaluate("proc a")).to.throw(
              'wrong # args: should be "proc name args body"'
            );
            expect(() => evaluate("proc a b")).to.throw(
              'wrong # args: should be "proc name args body"'
            );
            expect(() => evaluate("proc a b c d")).to.throw(
              'wrong # args: should be "proc name args body"'
            );
          });
          specify("argument with no name", () => {
            expect(() => evaluate("proc cmd {{}} {}")).to.throw(
              "argument with no name"
            );
            expect(() => evaluate("proc cmd {{{} def}} {}")).to.throw(
              "argument with no name"
            );
          });
          specify("wrong argument specifier format", () => {
            expect(() => evaluate("proc cmd {{a b c}} {}")).to.throw(
              'too many fields in argument specifier "a b c"'
            );
          });
        });
      });

      describe("return", () => {
        it("should return empty by default", () => {
          expect(evaluate("return")).to.eql(new StringValue(""));
        });
        it("should return an optional result", () => {
          expect(evaluate("return value")).to.eql(new StringValue("value"));
        });
        it("should interrupt a proc", () => {
          evaluate("proc cmd {} {return; set var val}");
          expect(evaluate("cmd")).to.eql(new StringValue(""));
        });
        it("should return result from a proc", () => {
          evaluate("proc cmd {} {return result; set var val}");
          expect(evaluate("cmd")).to.eql(new StringValue("result"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("return a b")).to.throw(
              'wrong # args: should be "return ?result?"'
            );
          });
        });
      });
    });
  }
});
