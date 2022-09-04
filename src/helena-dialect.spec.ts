import { expect } from "chai";
import { ResultCode } from "./command";
import { CompilingEvaluator, Evaluator, InlineEvaluator } from "./evaluator";
import { Parser } from "./parser";
import { Scope, initCommands, Variable, CommandValue } from "./helena-dialect";
import { Tokenizer } from "./tokenizer";
import { NIL, StringValue, TupleValue } from "./values";

describe("Helena dialect", () => {
  for (let klass of [InlineEvaluator, CompilingEvaluator]) {
    describe(klass.name, () => {
      let rootScope: Scope;

      let tokenizer: Tokenizer;
      let parser: Parser;
      let evaluator: Evaluator;

      const parse = (script: string) =>
        parser.parse(tokenizer.tokenize(script));
      const execute = (script: string) =>
        evaluator.executeScript(parse(script));
      const evaluate = (script: string) => {
        const [code, result] = execute(script);
        if (code == ResultCode.ERROR) throw new Error(result.asString());
        return result;
      };

      beforeEach(() => {
        rootScope = new Scope();
        initCommands(rootScope);

        tokenizer = new Tokenizer();
        parser = new Parser();
        evaluator = new klass(
          rootScope.variableResolver,
          rootScope.commandResolver,
          null
        );
      });

      describe("idem", () => {
        it("should return its argument", () => {
          expect(evaluate("idem val")).to.eql(new StringValue("val"));
          expect(evaluate("idem (a b c)")).to.eql(
            new TupleValue([
              new StringValue("a"),
              new StringValue("b"),
              new StringValue("c"),
            ])
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("idem")).to.throw(
              'wrong # args: should be "idem value"'
            );
            expect(() => evaluate("idem a b")).to.throw(
              'wrong # args: should be "idem value"'
            );
          });
        });
      });

      describe("constants and variables", () => {
        describe("let", () => {
          it("should define the value of a new constant", () => {
            evaluate("let cst val");
            expect(rootScope.constants.get("cst")).to.eql(
              new StringValue("val")
            );
          });
          it("should return the constant value", () => {
            expect(evaluate("let cst val")).to.eql(new StringValue("val"));
          });
          describe("exceptions", () => {
            it("existing constant", () => {
              rootScope.constants.set("cst", new StringValue("old"));
              expect(() => evaluate("let cst val")).to.throw(
                'cannot redefine constant "cst"'
              );
            });
            it("existing variable", () => {
              rootScope.variables.set(
                "var",
                new Variable(new StringValue("old"))
              );
              expect(() => evaluate("let var val")).to.throw(
                'cannot define constant "var": variable already exists'
              );
            });
            specify("wrong arity", () => {
              specify("wrong arity", () => {
                expect(() => evaluate("let")).to.throw(
                  'wrong # args: should be "let constName value"'
                );
                expect(() => evaluate("let a")).to.throw(
                  'wrong # args: should be "let constName value"'
                );
                expect(() => evaluate("let a b c")).to.throw(
                  'wrong # args: should be "let constName value"'
                );
              });
            });
          });
        });
        describe("set", () => {
          it("should set the value of a new variable", () => {
            evaluate("set var val");
            expect(rootScope.variables.get("var")).to.eql(
              new Variable(new StringValue("val"))
            );
          });
          it("should overwrite the value of an existing variable", () => {
            rootScope.variables.set(
              "var",
              new Variable(new StringValue("old"))
            );
            evaluate("set var val");
            expect(rootScope.variables.get("var")).to.eql(
              new Variable(new StringValue("val"))
            );
          });
          it("should return the set value", () => {
            expect(evaluate("set var val")).to.eql(new StringValue("val"));
          });
          describe("exceptions", () => {
            it("existing constant", () => {
              rootScope.constants.set("cst", new StringValue("old"));
              expect(() => evaluate("set cst val")).to.throw(
                'cannot redefine constant "cst"'
              );
            });
            specify("wrong arity", () => {
              expect(() => evaluate("set")).to.throw(
                'wrong # args: should be "set varName value"'
              );
              expect(() => evaluate("set a")).to.throw(
                'wrong # args: should be "set varName value"'
              );
              expect(() => evaluate("set a b c")).to.throw(
                'wrong # args: should be "set varName value"'
              );
            });
          });
        });
        describe("get", () => {});
        it("should return the value of an existing variable", () => {
          evaluate("let cst val");
          expect(evaluate("get cst")).to.eql(new StringValue("val"));
        });
        it("should return the value of an existing constant", () => {
          evaluate("set var val");
          expect(evaluate("get var")).to.eql(new StringValue("val"));
        });
        describe("exceptions", () => {
          specify("non-existing variable", () => {
            expect(() => evaluate("get unknownVariable")).to.throw(
              'can\'t read "unknownVariable": no such variable'
            );
          });
          specify("wrong arity", () => {
            expect(() => evaluate("get")).to.throw(
              'wrong # args: should be "get varName"'
            );
            expect(() => evaluate("get a b")).to.throw(
              'wrong # args: should be "get varName"'
            );
          });
        });
      });

      describe("commands", () => {
        describe("macro", () => {
          it("should define a new command", () => {
            execute("macro cmd {} {}");
            expect(rootScope.commands.has("cmd"));
          });
          it("should replace existing commands", () => {
            evaluate("macro cmd {} {}");
            expect(() => evaluate("macro cmd {} {}")).to.not.throw();
          });
          it("should return a command value", () => {
            expect(evaluate("macro {} {}")).to.be.instanceof(CommandValue);
            expect(evaluate("macro cmd {} {}")).to.be.instanceof(CommandValue);
          });
          it("should define a variable with command value when given a name", () => {
            const value = evaluate("macro cmd {} {}");
            expect(evaluate("get cmd")).to.eql(value);
          });
          describe("calls", () => {
            it("should return nil for empty body", () => {
              evaluate("macro cmd {} {}");
              expect(evaluate("cmd")).to.eql(NIL);
            });
            it("should return the result of the last command", () => {
              evaluate("macro cmd {} {idem val1; idem val2}");
              expect(evaluate("cmd")).to.eql(new StringValue("val2"));
            });
            it("should be callable by value", () => {
              evaluate("set cmd [macro {} {idem val}]");
              expect(evaluate("$cmd")).to.eql(new StringValue("val"));
            });
            it("should be callable by variable", () => {
              evaluate("macro cmd {} {idem val}");
              expect(evaluate("$cmd")).to.eql(new StringValue("val"));
            });
            it("should evaluate in the caller scope", () => {
              evaluate(
                "macro cmd {} {let cst val1; set var val2; macro cmd2 {} {}}"
              );
              evaluate("cmd");
              expect(rootScope.constants.get("cst")).to.eql(
                new StringValue("val1")
              );
              expect(rootScope.variables.get("var")).to.eql(
                new Variable(new StringValue("val2"))
              );
              expect(rootScope.commands.get("cmd2")).to.exist;
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
    });
  }
});
