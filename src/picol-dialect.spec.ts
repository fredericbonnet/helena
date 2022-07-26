import { expect } from "chai";
import { ResultCode } from "./command";
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
      const execute = (script: string) =>
        evaluator.executeScript(parse(script));
      const evaluate = (script: string) => {
        const [code, result] = execute(script);
        if (code == ResultCode.ERROR) throw new Error(result.asString());
        return result;
      };

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
      describe("logic", () => {
        describe("!", () => {
          it("should invert boolean values", () => {
            expect(evaluate("! true")).to.eql(FALSE);
            expect(evaluate("! false")).to.eql(TRUE);
          });
          it("should invert integer values", () => {
            expect(evaluate("! 1")).to.eql(FALSE);
            expect(evaluate("! 123")).to.eql(FALSE);
            expect(evaluate("! 0")).to.eql(TRUE);
          });
          it("should accept block expressions", () => {
            expect(evaluate("! {!= 1 2}")).to.eql(FALSE);
            expect(evaluate("! {== 1 2}")).to.eql(TRUE);
          });
          it("should propagate return", () => {
            expect(
              evaluate("proc cmd {} {! {return value}; error}; cmd")
            ).to.eql(new StringValue("value"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("!")).to.throw(
                'wrong # args: should be "! arg"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("! a")).to.throw('invalid boolean "a"');
            });
          });
        });
        describe("&&", () => {
          it("should accept one boolean", () => {
            expect(evaluate("&& false")).to.eql(FALSE);
            expect(evaluate("&& true")).to.eql(TRUE);
          });
          it("should accept two booleans", () => {
            expect(evaluate("&& false false")).to.eql(FALSE);
            expect(evaluate("&& false true")).to.eql(FALSE);
            expect(evaluate("&& true false")).to.eql(FALSE);
            expect(evaluate("&& true true")).to.eql(TRUE);
          });
          it("should accept several booleans", () => {
            expect(evaluate("&&" + " true".repeat(3))).to.eql(TRUE);
            expect(evaluate("&&" + " true".repeat(3) + " false")).to.eql(FALSE);
          });
          it("should accept block expressions", () => {
            expect(evaluate("&& {!= 1 2}")).to.eql(TRUE);
            expect(evaluate("&& {== 1 2}")).to.eql(FALSE);
          });
          it("should short-circuit on false", () => {
            expect(evaluate("&& false {error}")).to.eql(FALSE);
          });
          it("should propagate return", () => {
            expect(
              evaluate("proc cmd {} {&& {return value}; error}; cmd")
            ).to.eql(new StringValue("value"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("&&")).to.throw(
                'wrong # args: should be "&& arg ?arg ...?"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("&& a")).to.throw('invalid boolean "a"');
            });
          });
        });
        describe("||", () => {
          it("should accept two booleans", () => {
            expect(evaluate("|| false false")).to.eql(FALSE);
            expect(evaluate("|| false true")).to.eql(TRUE);
            expect(evaluate("|| true false")).to.eql(TRUE);
            expect(evaluate("|| true true")).to.eql(TRUE);
          });
          it("should accept several booleans", () => {
            expect(evaluate("||" + " false".repeat(3))).to.eql(FALSE);
            expect(evaluate("||" + " false".repeat(3) + " true")).to.eql(TRUE);
          });
          it("should accept block expressions", () => {
            expect(evaluate("|| {!= 1 2}")).to.eql(TRUE);
            expect(evaluate("|| {== 1 2}")).to.eql(FALSE);
          });
          it("should short-circuit on true", () => {
            expect(evaluate("|| true {error}")).to.eql(TRUE);
          });
          it("should propagate return", () => {
            expect(
              evaluate("proc cmd {} {|| {return value}; error}; cmd")
            ).to.eql(new StringValue("value"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("||")).to.throw(
                'wrong # args: should be "|| arg ?arg ...?"'
              );
            });
            specify("invalid value", () => {
              expect(() => evaluate("|| a")).to.throw('invalid boolean "a"');
            });
          });
        });
      });

      describe("control flow", () => {
        describe("if", () => {
          it("should evaluate the if branch when test is true", () => {
            expect(evaluate("if true {set var if}")).to.eql(
              new StringValue("if")
            );
            expect(evaluate("if 1 {set var if}")).to.eql(new StringValue("if"));
          });
          it("should evaluate the else branch when test is false", () => {
            expect(
              evaluate("if false {set var if} else {set var else}")
            ).to.eql(new StringValue("else"));
            expect(evaluate("if 0 {set var if} else {set var else}")).to.eql(
              new StringValue("else")
            );
          });
          it("should accept block expressions", () => {
            expect(
              evaluate("if {!= 1 2} {set var if} else {set var else}")
            ).to.eql(new StringValue("if"));
            expect(
              evaluate("if {== 1 2} {set var if} else {set var else}")
            ).to.eql(new StringValue("else"));
          });
          it("should return empty when test is false and there is no else branch", () => {
            expect(evaluate("if false {set var if}")).to.eql(
              new StringValue("")
            );
          });
          it("should propagate return", () => {
            evaluate(
              "proc cmd {expr} {if $expr {return if} else {return else}; error}"
            );
            expect(evaluate("cmd true")).to.eql(new StringValue("if"));
            expect(evaluate("cmd false")).to.eql(new StringValue("else"));
            expect(evaluate("cmd {!= 1 2}")).to.eql(new StringValue("if"));
            expect(evaluate("cmd {== 1 2}")).to.eql(new StringValue("else"));
            expect(evaluate("cmd {return test}")).to.eql(
              new StringValue("test")
            );
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
            specify("invalid condition", () => {
              expect(() => evaluate("if a {}")).to.throw('invalid boolean "a"');
            });
          });
        });
        describe("for", () => {
          it("should always evaluate the start segment", () => {
            expect(evaluate("for {set var start} false {} {}; set var")).to.eql(
              new StringValue("start")
            );
            expect(
              evaluate(
                "for {set var start} {== $var start} {set var ${var}2} {}; set var"
              )
            ).to.eql(new StringValue("start2"));
          });
          it("should skip the body when test is false", () => {
            expect(
              evaluate(
                "set var before; for {} false {set var next} {set var body}; set var"
              )
            ).to.eql(new StringValue("before"));
          });
          it("should skip next statement when test is false", () => {
            expect(
              evaluate(
                "set var before; for {} false {set var next} {}; set var"
              )
            ).to.eql(new StringValue("before"));
          });
          it("should loop over the body while test is true", () => {
            expect(
              evaluate("for {set i 0} {< $i 10} {incr i} {set var $i}; set var")
            ).to.eql(new NumberValue(9));
          });
          it("should return empty", () => {
            expect(
              evaluate("for {set i 0} {< $i 10} {incr i} {set var $i}")
            ).to.eql(new StringValue(""));
          });
          it("should propagate return", () => {
            evaluate(
              "proc cmd {start test next body} {for $start $test $next $body; set var val}"
            );
            expect(evaluate("cmd {return start} {} {} {}")).to.eql(
              new StringValue("start")
            );
            expect(evaluate("cmd {} {return test} {} {}")).to.eql(
              new StringValue("test")
            );
            expect(evaluate("cmd {} true {return next} {}")).to.eql(
              new StringValue("next")
            );
            expect(evaluate("cmd {} true {} {return body}")).to.eql(
              new StringValue("body")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("for")).to.throw(
                'wrong # args: should be "for start test next command"'
              );
              expect(() => evaluate("for a b c")).to.throw(
                'wrong # args: should be "for start test next command"'
              );
              expect(() => evaluate("for a b c d e")).to.throw(
                'wrong # args: should be "for start test next command"'
              );
            });
            specify("invalid condition", () => {
              expect(() => evaluate("for {} a {} {} ")).to.throw(
                'invalid boolean "a"'
              );
            });
          });
        });
        describe("while", () => {
          it("should skip the body when test is false", () => {
            expect(
              evaluate("set var before; while false {set var body}; set var")
            ).to.eql(new StringValue("before"));
          });
          it("should loop over the body while test is true", () => {
            expect(evaluate("set i 0; while {< $i 10} {incr i}; set i")).to.eql(
              new NumberValue(10)
            );
          });
          it("should return empty", () => {
            expect(evaluate("set i 0; while {< $i 10} {incr i}")).to.eql(
              new StringValue("")
            );
          });
          it("should propagate return", () => {
            evaluate(
              "proc cmd {test} {while $test {return body; error}; set var val}"
            );
            expect(evaluate("cmd true")).to.eql(new StringValue("body"));
            expect(evaluate("cmd false")).to.eql(new StringValue("val"));
            expect(evaluate("cmd {!= 1 2}")).to.eql(new StringValue("body"));
            expect(evaluate("cmd {== 1 2}")).to.eql(new StringValue("val"));
            expect(evaluate("cmd {return test}")).to.eql(
              new StringValue("test")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("while")).to.throw(
                'wrong # args: should be "while test script"'
              );
              expect(() => evaluate("while true")).to.throw(
                'wrong # args: should be "while test script"'
              );
              expect(() => evaluate("while true a b")).to.throw(
                'wrong # args: should be "while test script"'
              );
            });
            specify("invalid condition", () => {
              expect(() => evaluate("while a {}")).to.throw(
                'invalid boolean "a"'
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
            expect(evaluate("proc cmd {} {return; set var val}; cmd")).to.eql(
              new StringValue("")
            );
          });
          it("should return result from a proc", () => {
            expect(
              evaluate("proc cmd {} {return result; set var val}; cmd")
            ).to.eql(new StringValue("result"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("return a b")).to.throw(
                'wrong # args: should be "return ?result?"'
              );
            });
          });
        });
        describe("break", () => {
          it("should interrupt a for loop", () => {
            expect(
              evaluate(
                "for {set i 0} {< $i 10} {incr i} {set var before$i; break; set var after$i}; set var"
              )
            ).to.eql(new StringValue("before0"));
          });
          it("should interrupt a while loop", () => {
            expect(
              evaluate(
                "while true {set var before; break; set var after}; set var"
              )
            ).to.eql(new StringValue("before"));
          });
          it("should not interrupt a proc", () => {
            expect(
              evaluate(
                "proc cmd {} {for {set i 0} {< $i 10} {incr i} {break}; set i}; cmd"
              )
            ).to.eql(new StringValue("0"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("break a")).to.throw(
                'wrong # args: should be "break"'
              );
            });
          });
        });
        describe("continue", () => {
          it("should interrupt a for loop iteration", () => {
            expect(
              evaluate(
                "for {set i 0} {< $i 10} {incr i} {set var before$i; continue; set var after$i}; set var"
              )
            ).to.eql(new StringValue("before9"));
          });
          it("should interrupt a while loop iteration", () => {
            expect(
              evaluate(
                "set i 0; while {< $i 10} {incr i; set var before$i; continue; set var after$i}; set var"
              )
            ).to.eql(new StringValue("before10"));
          });
          it("should not interrupt a proc", () => {
            expect(
              evaluate(
                "proc cmd {} {for {set i 0} {< $i 10} {incr i} {continue}; set i}; cmd"
              )
            ).to.eql(new NumberValue(10));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(() => evaluate("continue a")).to.throw(
                'wrong # args: should be "continue"'
              );
            });
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
      describe("incr", () => {
        it("should set new variables to the increment", () => {
          evaluate("incr var 5");
          expect(rootScope.variables.get("var")).to.eql(new NumberValue(5));
        });
        it("should increment existing variables by the increment", () => {
          rootScope.variables.set("var", new NumberValue(2));
          evaluate("incr var 4");
          expect(rootScope.variables.get("var")).to.eql(new NumberValue(6));
        });
        specify("increment should default to 1", () => {
          rootScope.variables.set("var", new NumberValue(1));
          evaluate("incr var");
          expect(rootScope.variables.get("var")).to.eql(new NumberValue(2));
        });
        it("should return the new value", () => {
          expect(evaluate("set var 1; incr var")).to.eql(new NumberValue(2));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(() => evaluate("incr")).to.throw(
              'wrong # args: should be "incr varName ?increment?"'
            );
            expect(() => evaluate("incr a 1 2")).to.throw(
              'wrong # args: should be "incr varName ?increment?"'
            );
          });
          specify("invalid variable value", () => {
            expect(() => evaluate("set var a; incr var")).to.throw(
              'invalid number "a"'
            );
          });
          specify("invalid increment", () => {
            expect(() => evaluate("incr var a")).to.throw('invalid number "a"');
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
    });
  }
});
