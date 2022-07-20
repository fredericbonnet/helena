import { expect } from "chai";
import { CompilingEvaluator, Evaluator, InlineEvaluator } from "./evaluator";
import { Parser } from "./parser";
import { PicolScope, initPicolCommands } from "./picol-dialect";
import { Tokenizer } from "./tokenizer";
import { FALSE, TRUE, NumberValue, StringValue, TupleValue } from "./values";

describe("Picol dialect", () => {
  for (let klass of [InlineEvaluator, CompilingEvaluator]) {
    describe(klass.name, () => {
      let rootScope: PicolScope;

      let tokenizer: Tokenizer;
      let parser: Parser;
      let evaluator: Evaluator;

      const parse = (script: string) =>
        parser.parse(tokenizer.tokenize(script));
      const evaluate = (script: string) =>
        evaluator.executeScript(parse(script))[1];

      beforeEach(() => {
        rootScope = new PicolScope();
        initPicolCommands(rootScope);

        tokenizer = new Tokenizer();
        parser = new Parser();
        evaluator = new klass(
          rootScope.variableResolver,
          rootScope.commandResolver,
          null
        );
      });

      describe("math", () => {
        describe("+", () => {
          it("should accept one number", () => {
            expect(evaluate("+ 3")).to.eql(new NumberValue(3));
            expect(evaluate("+ -1.2e3")).to.eql(new NumberValue(-1.2e3));
          });
          it("should add two numbers", () => {
            expect(evaluate("+ 6 23")).to.eql(new NumberValue(6 + 23));
            expect(evaluate("+ 4.5e-3 -6")).to.eql(new NumberValue(4.5e-3 - 6));
          });
          it("should add several numbers", () => {
            const numbers = [];
            let total = 0;
            for (let i = 0; i < 10; i++) {
              const v = Math.random();
              numbers.push(v);
              total += v;
            }
            expect(evaluate("+ " + numbers.join(" "))).to.eql(
              new NumberValue(total)
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("+")).to.throw(
                'wrong # args: should be "+ arg ?arg ...?"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("+ a")).to.throw('invalid number "a"');
            });
          });
        });
        describe("-", () => {
          it("should negate one number", () => {
            expect(evaluate("- 6")).to.eql(new NumberValue(-6));
            expect(evaluate("- -3.4e5")).to.eql(new NumberValue(3.4e5));
          });
          it("should subtract two numbers", () => {
            expect(evaluate("- 4 12")).to.eql(new NumberValue(4 - 12));
            expect(evaluate("- 12.3e4 -56")).to.eql(
              new NumberValue(12.3e4 + 56)
            );
          });
          it("should subtract several numbers", () => {
            const numbers = [];
            let total = 0;
            for (let i = 0; i < 10; i++) {
              const v = Math.random();
              numbers.push(v);
              if (i == 0) total = v;
              else total -= v;
            }
            expect(evaluate("- " + numbers.join(" "))).to.eql(
              new NumberValue(total)
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("-")).to.throw(
                'wrong # args: should be "- arg ?arg ...?"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("- a")).to.throw('invalid number "a"');
            });
          });
        });
        describe("*", () => {
          it("should accept one number", () => {
            expect(evaluate("* 12")).to.eql(new NumberValue(12));
            expect(evaluate("* -67.89")).to.eql(new NumberValue(-67.89));
          });
          it("should multiply two numbers", () => {
            expect(evaluate("* 45 67")).to.eql(new NumberValue(45 * 67));
            expect(evaluate("* 1.23e-4 -56")).to.eql(
              new NumberValue(1.23e-4 * -56)
            );
          });
          it("should add several numbers", () => {
            const numbers = [];
            let total = 1;
            for (let i = 0; i < 10; i++) {
              const v = Math.random();
              numbers.push(v);
              total *= v;
            }
            expect(evaluate("* " + numbers.join(" "))).to.eql(
              new NumberValue(total)
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("*")).to.throw(
                'wrong # args: should be "* arg ?arg ...?"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("* a")).to.throw('invalid number "a"');
            });
          });
        });
        describe("/", () => {
          it("should divide two numbers", () => {
            expect(evaluate("/ 12 -34")).to.eql(new NumberValue(12 / -34));
            expect(evaluate("/ 45.67e8 -123")).to.eql(
              new NumberValue(45.67e8 / -123)
            );
          });
          it("should divide several numbers", () => {
            const numbers = [];
            let total = 0;
            for (let i = 0; i < 10; i++) {
              const v = Math.random() || 0.1;
              numbers.push(v);
              if (i == 0) total = v;
              else total /= v;
            }
            expect(evaluate("/ " + numbers.join(" "))).to.eql(
              new NumberValue(total)
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("/")).to.throw(
                'wrong # args: should be "/ arg arg ?arg ...?"'
              );
              expect(() => evaluate("/ 1")).to.throw(
                'wrong # args: should be "/ arg arg ?arg ...?"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("/ a 1")).to.throw('invalid number "a"');
              expect(() => evaluate("/ 2 b")).to.throw('invalid number "b"');
            });
          });
        });
      });
      describe("comparisons", () => {
        describe("==", () => {
          it("should compare two values", () => {
            expect(evaluate('== "123" -34')).to.equal(FALSE);
            expect(evaluate('== 56 "56"')).to.equal(TRUE);
            expect(evaluate('== abc "abc"')).to.equal(TRUE);
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("==")).to.throw(
                'wrong # args: should be "== arg arg"'
              );
              expect(() => evaluate("== a")).to.throw(
                'wrong # args: should be "== arg arg"'
              );
            });
          });
        });
        describe("!=", () => {
          it("should compare two values", () => {
            expect(evaluate('!= "123" -34')).to.equal(TRUE);
            expect(evaluate('!= 56 "56"')).to.equal(FALSE);
            expect(evaluate('!= abc "abc"')).to.equal(FALSE);
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("!=")).to.throw(
                'wrong # args: should be "!= arg arg"'
              );
            });
            specify("wrong arity", () => {
              expect(() => evaluate("!= a")).to.throw(
                'wrong # args: should be "!= arg arg"'
              );
            });
          });
        });
        describe(">", () => {
          it("should compare two numbers", () => {
            expect(evaluate("> 12 -34")).to.equal(TRUE);
            expect(evaluate("> 56 56")).to.equal(FALSE);
            expect(evaluate("> -45.6e7 890")).to.equal(FALSE);
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate(">")).to.throw(
                'wrong # args: should be "> arg arg"'
              );
              expect(() => evaluate("> a")).to.throw(
                'wrong # args: should be "> arg arg"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("> a 1")).to.throw('invalid number "a"');
              expect(() => evaluate("> 2 b")).to.throw('invalid number "b"');
            });
          });
        });
        describe(">=", () => {
          it("should compare two numbers", () => {
            expect(evaluate(">= 12 -34")).to.equal(TRUE);
            expect(evaluate(">= 56 56")).to.equal(TRUE);
            expect(evaluate(">= -45.6e7 890")).to.equal(FALSE);
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate(">=")).to.throw(
                'wrong # args: should be ">= arg arg"'
              );
              expect(() => evaluate(">= a")).to.throw(
                'wrong # args: should be ">= arg arg"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate(">= a 1")).to.throw('invalid number "a"');
              expect(() => evaluate(">= 2 b")).to.throw('invalid number "b"');
            });
          });
        });
        describe("<", () => {
          it("should compare two numbers", () => {
            expect(evaluate("< 12 -34")).to.equal(FALSE);
            expect(evaluate("< 56 56")).to.equal(FALSE);
            expect(evaluate("< -45.6e7 890")).to.equal(TRUE);
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("<")).to.throw(
                'wrong # args: should be "< arg arg"'
              );
              expect(() => evaluate("< a")).to.throw(
                'wrong # args: should be "< arg arg"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("< a 1")).to.throw('invalid number "a"');
              expect(() => evaluate("< 2 b")).to.throw('invalid number "b"');
            });
          });
        });
        describe("<=", () => {
          it("should compare two numbers", () => {
            expect(evaluate("<= 12 -34")).to.equal(FALSE);
            expect(evaluate("<= 56 56")).to.equal(TRUE);
            expect(evaluate("<= -45.6e7 890")).to.equal(TRUE);
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("<=")).to.throw(
                'wrong # args: should be "<= arg arg"'
              );
              expect(() => evaluate("<= a")).to.throw(
                'wrong # args: should be "<= arg arg"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("<= a 1")).to.throw('invalid number "a"');
              expect(() => evaluate("<= 2 b")).to.throw('invalid number "b"');
            });
          });
        });
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
