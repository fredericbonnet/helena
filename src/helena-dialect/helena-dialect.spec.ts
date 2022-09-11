import { expect } from "chai";
import { ResultCode } from "../core/command";
import {
  CompilingEvaluator,
  Evaluator,
  InlineEvaluator,
} from "../core/evaluator";
import { Parser } from "../core/parser";
import { Scope, initCommands, Variable, CommandValue } from "./helena-dialect";
import { Tokenizer } from "../core/tokenizer";
import { NIL, StringValue, TupleValue } from "../core/values";

describe("Helena dialect", () => {
  for (const klass of [InlineEvaluator, CompilingEvaluator]) {
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
              expect(() => evaluate("let")).to.throw(
                'wrong # args: should be "let constname value"'
              );
              expect(() => evaluate("let a")).to.throw(
                'wrong # args: should be "let constname value"'
              );
              expect(() => evaluate("let a b c")).to.throw(
                'wrong # args: should be "let constname value"'
              );
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
                'wrong # args: should be "set varname value"'
              );
              expect(() => evaluate("set a")).to.throw(
                'wrong # args: should be "set varname value"'
              );
              expect(() => evaluate("set a b c")).to.throw(
                'wrong # args: should be "set varname value"'
              );
            });
          });
        });
        describe("get", () => {
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
                'wrong # args: should be "get varname"'
              );
              expect(() => evaluate("get a b")).to.throw(
                'wrong # args: should be "get varname"'
              );
            });
          });
        });
      });

      describe("scope", () => {
        it("should define a new command", () => {
          evaluate("scope cmd {}");
          expect(rootScope.commands.has("cmd"));
        });
        it("should replace existing commands", () => {
          evaluate("scope cmd {}");
          expect(() => evaluate("scope cmd {}")).to.not.throw();
        });
        it("should return a command value", () => {
          expect(evaluate("scope {}")).to.be.instanceof(CommandValue);
          expect(evaluate("scope cmd  {}")).to.be.instanceof(CommandValue);
        });
        it("should define a variable with command value when given a name", () => {
          const value = evaluate("scope cmd {}");
          expect(evaluate("get cmd")).to.eql(value);
        });
        specify("command should return self", () => {
          const value = evaluate("scope cmd {}");
          expect(evaluate("cmd")).to.eql(value);
        });
        describe("body", () => {
          it("should be executed", () => {
            evaluate("closure cmd {} {let var val}");
            expect(rootScope.constants.has("var")).to.be.false;
            evaluate("scope {cmd}");
            expect(rootScope.constants.get("var")).to.eql(
              new StringValue("val")
            );
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
            expect(evaluate("cmd eval {get var}")).to.eql(
              new StringValue("val2")
            );
            expect(evaluate("cmd eval {get cst}")).to.eql(
              new StringValue("val3")
            );
          });
        });
        describe("methods", () => {
          describe("eval", () => {
            it("should evaluate body", () => {
              evaluate("scope cmd {let cst val}");
              expect(evaluate("cmd eval {get cst}")).to.eql(
                new StringValue("val")
              );
            });
            it("should evaluate macros in scope", () => {
              evaluate("scope cmd {macro mac {} {let cst val}}");
              evaluate("cmd eval {mac}");
              expect(rootScope.constants.has("cst")).to.be.false;
              expect(evaluate("cmd eval {get cst}")).to.eql(
                new StringValue("val")
              );
            });
            it("should evaluate closures in their scope", () => {
              evaluate("closure cls {} {let cst val}");
              evaluate("scope cmd {}");
              evaluate("cmd eval {cls}");
              expect(rootScope.constants.get("cst")).to.eql(
                new StringValue("val")
              );
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
              evaluate('scope cmd {macro mac {} {idem "val"}}');
              expect(evaluate("cmd call mac")).to.eql(new StringValue("val"));
            });
            it("should evaluate macros in scope", () => {
              evaluate("scope cmd {macro mac {} {let cst val}}");
              evaluate("cmd call mac");
              expect(rootScope.constants.has("cst")).to.be.false;
              expect(evaluate("cmd eval {get cst}")).to.eql(
                new StringValue("val")
              );
            });
            it("should evaluate closures in scope", () => {
              evaluate("scope cmd {closure cls {} {let cst val}}");
              evaluate("cmd call cls");
              expect(rootScope.constants.has("cst")).to.be.false;
              expect(evaluate("cmd eval {get cst}")).to.eql(
                new StringValue("val")
              );
            });
            describe("exceptions", () => {
              specify("wrong arity", () => {
                expect(() => evaluate("[scope {}] call")).to.throw(
                  'wrong # args: should be "scope call cmdname ?arg ...?"'
                );
              });
              specify("non-existing command", () => {
                expect(() =>
                  evaluate("[scope {}] call unknownCommand")
                ).to.throw('invalid command name "unknownCommand"');
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

      describe("commands", () => {
        describe("macro", () => {
          it("should define a new command", () => {
            evaluate("macro cmd {} {}");
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
                expect(evaluate("scp eval {cmd2}")).to.eql(
                  new StringValue("val3")
                );
              });
              specify("scoped macro", () => {
                evaluate(
                  "scope scp1 {macro cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}}"
                );
                evaluate("scope scp2 {[scp1 eval {get cmd}]}");
                expect(() => evaluate("scp1 eval {get cst}")).to.throw();
                expect(() => evaluate("scp1 eval {get var}")).to.throw();
                expect(() => evaluate("scp1 eval {cmd2}")).to.throw();
                expect(evaluate("scp2 eval {get cst}")).to.eql(
                  new StringValue("val1")
                );
                expect(evaluate("scp2 eval {get var}")).to.eql(
                  new StringValue("val2")
                );
                expect(evaluate("scp2 eval {cmd2}")).to.eql(
                  new StringValue("val3")
                );
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

        describe("closure", () => {
          it("should define a new command", () => {
            evaluate("closure cmd {} {}");
            expect(rootScope.commands.has("cmd"));
          });
          it("should replace existing commands", () => {
            evaluate("closure cmd {} {}");
            expect(() => evaluate("closure cmd {} {}")).to.not.throw();
          });
          it("should return a command value", () => {
            expect(evaluate("closure {} {}")).to.be.instanceof(CommandValue);
            expect(evaluate("closure cmd {} {}")).to.be.instanceof(
              CommandValue
            );
          });
          it("should define a variable with command value when given a name", () => {
            const value = evaluate("closure cmd {} {}");
            expect(evaluate("get cmd")).to.eql(value);
          });
          describe("calls", () => {
            it("should return nil for empty body", () => {
              evaluate("closure cmd {} {}");
              expect(evaluate("cmd")).to.eql(NIL);
            });
            it("should return the result of the last command", () => {
              evaluate("closure cmd {} {idem val1; idem val2}");
              expect(evaluate("cmd")).to.eql(new StringValue("val2"));
            });
            it("should be callable by value", () => {
              evaluate("set cmd [closure {} {idem val}]");
              expect(evaluate("$cmd")).to.eql(new StringValue("val"));
            });
            it("should be callable by variable", () => {
              evaluate("closure cmd {} {idem val}");
              expect(evaluate("$cmd")).to.eql(new StringValue("val"));
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
                  "scope scp1 {closure cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}}"
                );
                evaluate("scope scp2 {[scp1 eval {get cmd}]}");
                expect(evaluate("scp1 eval {get cst}")).to.eql(
                  new StringValue("val1")
                );
                expect(evaluate("scp1 eval {get var}")).to.eql(
                  new StringValue("val2")
                );
                expect(evaluate("scp1 eval {cmd2}")).to.eql(
                  new StringValue("val3")
                );
                expect(() => evaluate("scp2 eval {get cst}")).to.throw();
                expect(() => evaluate("scp2 eval {get var}")).to.throw();
                expect(() => evaluate("scp2 eval {cmd2}")).to.throw();
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
    });
  }
});
