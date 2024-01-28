import { expect } from "chai";
import { ERROR, ResultCode } from "../core/results";
import { CompilingEvaluator, InlineEvaluator } from "../core/evaluator";
import { Parser } from "../core/parser";
import { PicolScope, initPicolCommands } from "./picol-dialect";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, TRUE, INT, REAL, STR, TUPLE } from "../core/values";

describe("Picol dialect", () => {
  for (const klass of [InlineEvaluator, CompilingEvaluator]) {
    describe(klass.name, () => {
      let rootScope: PicolScope;

      let tokenizer: Tokenizer;
      let parser: Parser;

      const parse = (script: string) =>
        parser.parse(tokenizer.tokenize(script)).script;
      const execute = (script: string) =>
        rootScope.evaluator.evaluateScript(parse(script));
      const evaluate = (script: string) => execute(script).value;

      beforeEach(() => {
        rootScope = new PicolScope();
        initPicolCommands(rootScope);

        tokenizer = new Tokenizer();
        parser = new Parser();
      });

      describe("math", () => {
        describe("+", () => {
          it("should accept one number", () => {
            expect(evaluate("+ 3")).to.eql(REAL(3));
            expect(evaluate("+ -1.2e3")).to.eql(REAL(-1.2e3));
          });
          it("should add two numbers", () => {
            expect(evaluate("+ 6 23")).to.eql(REAL(6 + 23));
            expect(evaluate("+ 4.5e-3 -6")).to.eql(REAL(4.5e-3 - 6));
          });
          it("should add several numbers", () => {
            const numbers = [];
            let total = 0;
            for (let i = 0; i < 10; i++) {
              const v = Math.random();
              numbers.push(v);
              total += v;
            }
            expect(evaluate("+ " + numbers.join(" "))).to.eql(REAL(total));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("+")).to.eql(
                ERROR('wrong # args: should be "+ arg ?arg ...?"')
              );
            });
            specify("invalid value", () => {
              expect(execute("+ a")).to.eql(ERROR('invalid number "a"'));
            });
          });
        });
        describe("-", () => {
          it("should negate one number", () => {
            expect(evaluate("- 6")).to.eql(REAL(-6));
            expect(evaluate("- -3.4e5")).to.eql(REAL(3.4e5));
          });
          it("should subtract two numbers", () => {
            expect(evaluate("- 4 12")).to.eql(REAL(4 - 12));
            expect(evaluate("- 12.3e4 -56")).to.eql(REAL(12.3e4 + 56));
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
            expect(evaluate("- " + numbers.join(" "))).to.eql(REAL(total));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("-")).to.eql(
                ERROR('wrong # args: should be "- arg ?arg ...?"')
              );
            });
            specify("invalid value", () => {
              expect(execute("- a")).to.eql(ERROR('invalid number "a"'));
            });
          });
        });
        describe("*", () => {
          it("should accept one number", () => {
            expect(evaluate("* 12")).to.eql(REAL(12));
            expect(evaluate("* -67.89")).to.eql(REAL(-67.89));
          });
          it("should multiply two numbers", () => {
            expect(evaluate("* 45 67")).to.eql(REAL(45 * 67));
            expect(evaluate("* 1.23e-4 -56")).to.eql(REAL(1.23e-4 * -56));
          });
          it("should multiply several numbers", () => {
            const numbers = [];
            let total = 1;
            for (let i = 0; i < 10; i++) {
              const v = Math.random();
              numbers.push(v);
              total *= v;
            }
            expect(evaluate("* " + numbers.join(" "))).to.eql(REAL(total));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("*")).to.eql(
                ERROR('wrong # args: should be "* arg ?arg ...?"')
              );
            });
            specify("invalid value", () => {
              expect(execute("* a")).to.eql(ERROR('invalid number "a"'));
            });
          });
        });
        describe("/", () => {
          it("should divide two numbers", () => {
            expect(evaluate("/ 12 -34")).to.eql(REAL(12 / -34));
            expect(evaluate("/ 45.67e8 -123")).to.eql(REAL(45.67e8 / -123));
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
            expect(evaluate("/ " + numbers.join(" "))).to.eql(REAL(total));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("/")).to.eql(
                ERROR('wrong # args: should be "/ arg arg ?arg ...?"')
              );
              expect(execute("/ 1")).to.eql(
                ERROR('wrong # args: should be "/ arg arg ?arg ...?"')
              );
            });
            specify("invalid value", () => {
              expect(execute("/ a 1")).to.eql(ERROR('invalid number "a"'));
              expect(execute("/ 2 b")).to.eql(ERROR('invalid number "b"'));
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
              expect(execute("==")).to.eql(
                ERROR('wrong # args: should be "== arg arg"')
              );
              expect(execute("== a")).to.eql(
                ERROR('wrong # args: should be "== arg arg"')
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
              expect(execute("!=")).to.eql(
                ERROR('wrong # args: should be "!= arg arg"')
              );
              expect(execute("!= a")).to.eql(
                ERROR('wrong # args: should be "!= arg arg"')
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
              expect(execute(">")).to.eql(
                ERROR('wrong # args: should be "> arg arg"')
              );
              expect(execute("> a")).to.eql(
                ERROR('wrong # args: should be "> arg arg"')
              );
            });
            specify("invalid value", () => {
              expect(execute("> a 1")).to.eql(ERROR('invalid number "a"'));
              expect(execute("> 2 b")).to.eql(ERROR('invalid number "b"'));
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
              expect(execute(">=")).to.eql(
                ERROR('wrong # args: should be ">= arg arg"')
              );
              expect(execute(">= a")).to.eql(
                ERROR('wrong # args: should be ">= arg arg"')
              );
            });
            specify("invalid value", () => {
              expect(execute(">= a 1")).to.eql(ERROR('invalid number "a"'));
              expect(execute(">= 2 b")).to.eql(ERROR('invalid number "b"'));
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
              expect(execute("<")).to.eql(
                ERROR('wrong # args: should be "< arg arg"')
              );
              expect(execute("< a")).to.eql(
                ERROR('wrong # args: should be "< arg arg"')
              );
            });
            specify("invalid value", () => {
              expect(execute("< a 1")).to.eql(ERROR('invalid number "a"'));
              expect(execute("< 2 b")).to.eql(ERROR('invalid number "b"'));
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
              expect(execute("<=")).to.eql(
                ERROR('wrong # args: should be "<= arg arg"')
              );
              expect(execute("<= a")).to.eql(
                ERROR('wrong # args: should be "<= arg arg"')
              );
            });
            specify("invalid value", () => {
              expect(execute("<= a 1")).to.eql(ERROR('invalid number "a"'));
              expect(execute("<= 2 b")).to.eql(ERROR('invalid number "b"'));
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
            ).to.eql(STR("value"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("!")).to.eql(
                ERROR('wrong # args: should be "! arg"')
              );
            });
            specify("invalid value", () => {
              expect(execute("! a")).to.eql(ERROR('invalid boolean "a"'));
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
            ).to.eql(STR("value"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("&&")).to.eql(
                ERROR('wrong # args: should be "&& arg ?arg ...?"')
              );
            });
            specify("invalid value", () => {
              expect(execute("&& a")).to.eql(ERROR('invalid boolean "a"'));
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
            ).to.eql(STR("value"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("||")).to.eql(
                ERROR('wrong # args: should be "|| arg ?arg ...?"')
              );
            });
            specify("invalid value", () => {
              expect(execute("|| a")).to.eql(ERROR('invalid boolean "a"'));
            });
          });
        });
      });

      describe("control flow", () => {
        describe("if", () => {
          it("should evaluate the if branch when test is true", () => {
            expect(evaluate("if true {set var if}")).to.eql(STR("if"));
            expect(evaluate("if 1 {set var if}")).to.eql(STR("if"));
          });
          it("should evaluate the else branch when test is false", () => {
            expect(
              evaluate("if false {set var if} else {set var else}")
            ).to.eql(STR("else"));
            expect(evaluate("if 0 {set var if} else {set var else}")).to.eql(
              STR("else")
            );
          });
          it("should accept block expressions", () => {
            expect(
              evaluate("if {!= 1 2} {set var if} else {set var else}")
            ).to.eql(STR("if"));
            expect(
              evaluate("if {== 1 2} {set var if} else {set var else}")
            ).to.eql(STR("else"));
          });
          it("should return empty when test is false and there is no else branch", () => {
            expect(evaluate("if false {set var if}")).to.eql(STR(""));
          });
          it("should propagate return", () => {
            evaluate(
              "proc cmd {expr} {if $expr {return if} else {return else}; error}"
            );
            expect(evaluate("cmd true")).to.eql(STR("if"));
            expect(evaluate("cmd false")).to.eql(STR("else"));
            expect(evaluate("cmd {!= 1 2}")).to.eql(STR("if"));
            expect(evaluate("cmd {== 1 2}")).to.eql(STR("else"));
            expect(evaluate("cmd {return test}")).to.eql(STR("test"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("if")).to.eql(
                ERROR(
                  'wrong # args: should be "if test script1 ?else script2?"'
                )
              );
              expect(execute("if true")).to.eql(
                ERROR(
                  'wrong # args: should be "if test script1 ?else script2?"'
                )
              );
              expect(execute("if true {} else")).to.eql(
                ERROR(
                  'wrong # args: should be "if test script1 ?else script2?"'
                )
              );
              expect(execute("if true {} else {} {}")).to.eql(
                ERROR(
                  'wrong # args: should be "if test script1 ?else script2?"'
                )
              );
            });
            specify("invalid condition", () => {
              expect(execute("if a {}")).to.eql(ERROR('invalid boolean "a"'));
            });
          });
        });
        describe("for", () => {
          it("should always evaluate the start segment", () => {
            expect(evaluate("for {set var start} false {} {}; set var")).to.eql(
              STR("start")
            );
            expect(
              evaluate(
                "for {set var start} {== $var start} {set var ${var}2} {}; set var"
              )
            ).to.eql(STR("start2"));
          });
          it("should skip the body when test is false", () => {
            expect(
              evaluate(
                "set var before; for {} false {set var next} {set var body}; set var"
              )
            ).to.eql(STR("before"));
          });
          it("should skip next statement when test is false", () => {
            expect(
              evaluate(
                "set var before; for {} false {set var next} {}; set var"
              )
            ).to.eql(STR("before"));
          });
          it("should loop over the body while test is true", () => {
            expect(
              evaluate("for {set i 0} {< $i 10} {incr i} {set var $i}; set var")
            ).to.eql(INT(9));
          });
          it("should return empty", () => {
            expect(
              evaluate("for {set i 0} {< $i 10} {incr i} {set var $i}")
            ).to.eql(STR(""));
          });
          it("should propagate return", () => {
            evaluate(
              "proc cmd {start test next body} {for $start $test $next $body; set var val}"
            );
            expect(evaluate("cmd {return start} {} {} {}")).to.eql(
              STR("start")
            );
            expect(evaluate("cmd {} {return test} {} {}")).to.eql(STR("test"));
            expect(evaluate("cmd {} true {return next} {}")).to.eql(
              STR("next")
            );
            expect(evaluate("cmd {} true {} {return body}")).to.eql(
              STR("body")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("for")).to.eql(
                ERROR('wrong # args: should be "for start test next command"')
              );
              expect(execute("for a b c")).to.eql(
                ERROR('wrong # args: should be "for start test next command"')
              );
              expect(execute("for a b c d e")).to.eql(
                ERROR('wrong # args: should be "for start test next command"')
              );
            });
            specify("invalid condition", () => {
              expect(execute("for {} a {} {} ")).to.eql(
                ERROR('invalid boolean "a"')
              );
            });
          });
        });
        describe("while", () => {
          it("should skip the body when test is false", () => {
            expect(
              evaluate("set var before; while false {set var body}; set var")
            ).to.eql(STR("before"));
          });
          it("should loop over the body while test is true", () => {
            expect(evaluate("set i 0; while {< $i 10} {incr i}; set i")).to.eql(
              INT(10)
            );
          });
          it("should return empty", () => {
            expect(evaluate("set i 0; while {< $i 10} {incr i}")).to.eql(
              STR("")
            );
          });
          it("should propagate return", () => {
            evaluate(
              "proc cmd {test} {while $test {return body; error}; set var val}"
            );
            expect(evaluate("cmd true")).to.eql(STR("body"));
            expect(evaluate("cmd false")).to.eql(STR("val"));
            expect(evaluate("cmd {!= 1 2}")).to.eql(STR("body"));
            expect(evaluate("cmd {== 1 2}")).to.eql(STR("val"));
            expect(evaluate("cmd {return test}")).to.eql(STR("test"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("while")).to.eql(
                ERROR('wrong # args: should be "while test script"')
              );
              expect(execute("while true")).to.eql(
                ERROR('wrong # args: should be "while test script"')
              );
              expect(execute("while true a b")).to.eql(
                ERROR('wrong # args: should be "while test script"')
              );
            });
            specify("invalid condition", () => {
              expect(execute("while a {}")).to.eql(
                ERROR('invalid boolean "a"')
              );
            });
          });
        });
        describe("return", () => {
          it("should return empty by default", () => {
            expect(evaluate("return")).to.eql(STR(""));
          });
          it("should return an optional result", () => {
            expect(evaluate("return value")).to.eql(STR("value"));
          });
          it("should interrupt a proc", () => {
            expect(evaluate("proc cmd {} {return; set var val}; cmd")).to.eql(
              STR("")
            );
          });
          it("should return result from a proc", () => {
            expect(
              evaluate("proc cmd {} {return result; set var val}; cmd")
            ).to.eql(STR("result"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("return a b")).to.eql(
                ERROR('wrong # args: should be "return ?result?"')
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
            ).to.eql(STR("before0"));
          });
          it("should interrupt a while loop", () => {
            expect(
              evaluate(
                "while true {set var before; break; set var after}; set var"
              )
            ).to.eql(STR("before"));
          });
          it("should not interrupt a proc", () => {
            expect(
              evaluate(
                "proc cmd {} {for {set i 0} {< $i 10} {incr i} {break}; set i}; cmd"
              )
            ).to.eql(STR("0"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("break a")).to.eql(
                ERROR('wrong # args: should be "break"')
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
            ).to.eql(STR("before9"));
          });
          it("should interrupt a while loop iteration", () => {
            expect(
              evaluate(
                "set i 0; while {< $i 10} {incr i; set var before$i; continue; set var after$i}; set var"
              )
            ).to.eql(STR("before10"));
          });
          it("should not interrupt a proc", () => {
            expect(
              evaluate(
                "proc cmd {} {for {set i 0} {< $i 10} {incr i} {continue}; set i}; cmd"
              )
            ).to.eql(INT(10));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("continue a")).to.eql(
                ERROR('wrong # args: should be "continue"')
              );
            });
          });
        });
        describe("error", () => {
          it("should interrupt a for loop", () => {
            expect(
              execute(
                "for {set i 0} {< $i 10} {incr i} {set var before$i; error message; set var after$i}; set var"
              )
            ).to.eql(ERROR("message"));
          });
          it("should interrupt a while loop", () => {
            expect(
              execute(
                "while true {set var before; error message; set var after}; set var"
              )
            ).to.eql(ERROR("message"));
          });
          it("should interrupt a proc", () => {
            expect(
              execute("proc cmd {} {error message; set var val}; cmd")
            ).to.eql(ERROR("message"));
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("error")).to.eql(
                ERROR('wrong # args: should be "error message"')
              );
            });
          });
        });
      });

      describe("set", () => {
        it("should return the value of an existing variable", () => {
          rootScope.variables.set("var", STR("val"));
          expect(evaluate("set var")).to.eql(STR("val"));
        });
        it("should set the value of a new variable", () => {
          evaluate("set var val");
          expect(rootScope.variables.get("var")).to.eql(STR("val"));
        });
        it("should overwrite the value of an existing variable", () => {
          rootScope.variables.set("var", STR("old"));
          evaluate("set var val");
          expect(rootScope.variables.get("var")).to.eql(STR("val"));
        });
        it("should return the set value", () => {
          expect(evaluate("set var val")).to.eql(STR("val"));
        });
        describe("exceptions", () => {
          specify("non-existing variable", () => {
            expect(execute("set unknownVariable")).to.eql(
              ERROR('can\'t read "unknownVariable": no such variable')
            );
          });
          specify("wrong arity", () => {
            expect(execute("set")).to.eql(
              ERROR('wrong # args: should be "set varName ?newValue?"')
            );
            expect(execute("set a b c")).to.eql(
              ERROR('wrong # args: should be "set varName ?newValue?"')
            );
          });
        });
      });
      describe("incr", () => {
        it("should set new variables to the increment", () => {
          evaluate("incr var 5");
          expect(rootScope.variables.get("var")).to.eql(INT(5));
        });
        it("should increment existing variables by the increment", () => {
          rootScope.variables.set("var", INT(2));
          evaluate("incr var 4");
          expect(rootScope.variables.get("var")).to.eql(INT(6));
        });
        specify("increment should default to 1", () => {
          rootScope.variables.set("var", INT(1));
          evaluate("incr var");
          expect(rootScope.variables.get("var")).to.eql(INT(2));
        });
        it("should return the new value", () => {
          expect(evaluate("set var 1; incr var")).to.eql(INT(2));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("incr")).to.eql(
              ERROR('wrong # args: should be "incr varName ?increment?"')
            );
            expect(execute("incr a 1 2")).to.eql(
              ERROR('wrong # args: should be "incr varName ?increment?"')
            );
          });
          specify("invalid variable value", () => {
            expect(execute("set var a; incr var")).to.eql(
              ERROR('invalid integer "a"')
            );
          });
          specify("invalid increment", () => {
            expect(execute("incr var a")).to.eql(ERROR('invalid integer "a"'));
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
          expect(execute("proc cmd {} {}").code).to.eql(ResultCode.OK);
        });
        it("should return empty", () => {
          expect(evaluate("proc cmd {} {}")).to.eql(STR(""));
        });
        describe("calls", () => {
          it("should return empty string for empty body", () => {
            evaluate("proc cmd {} {}");
            expect(evaluate("cmd")).to.eql(STR(""));
          });
          it("should return the result of the last command", () => {
            evaluate("proc cmd {} {set var val}");
            expect(evaluate("cmd")).to.eql(STR("val"));
          });
          it("should access global commands", () => {
            evaluate("proc cmd2 {} {set var val}");
            evaluate("proc cmd {} {cmd2}");
            expect(evaluate("cmd")).to.eql(STR("val"));
          });
          it("should not access global variables", () => {
            evaluate("set var val");
            evaluate("proc cmd {} {set var}");
            expect(execute("cmd").code).to.eql(ResultCode.ERROR);
          });
          it("should not set global variables", () => {
            evaluate("set var val");
            evaluate("proc cmd {} {set var val2}");
            evaluate("cmd");
            expect(rootScope.variables.get("var")).to.eql(STR("val"));
          });
          it("should set local variables", () => {
            evaluate("set var val");
            evaluate("proc cmd {} {set var2 val}");
            evaluate("cmd");
            expect(!rootScope.variables.has("var2"));
          });
          it("should map arguments to local variables", () => {
            evaluate("proc cmd {param} {set param}");
            expect(evaluate("cmd arg")).to.eql(STR("arg"));
            expect(!rootScope.variables.has("param"));
          });
          it("should accept default argument values", () => {
            evaluate(
              "proc cmd {param1 {param2 def}} {set var ($param1 $param2)}"
            );
            expect(evaluate("cmd arg")).to.eql(TUPLE([STR("arg"), STR("def")]));
          });
          it("should accept remaining args", () => {
            evaluate("proc cmd {param1 param2 args} {set var $args}");
            expect(evaluate("cmd 1 2")).to.eql(TUPLE([]));
            expect(evaluate("cmd 1 2 3 4")).to.eql(TUPLE([STR("3"), STR("4")]));
          });
          it("should accept both default and remaining args", () => {
            evaluate(
              "proc cmd {param1 {param2 def} args} {set var ($param1 $param2 $*args)}"
            );
            expect(evaluate("cmd 1 2")).to.eql(TUPLE([STR("1"), STR("2")]));
            expect(evaluate("cmd 1 2 3 4")).to.eql(
              TUPLE([STR("1"), STR("2"), STR("3"), STR("4")])
            );
          });
          describe("exceptions", () => {
            specify("not enough arguments", () => {
              expect(execute("proc cmd {a b} {}; cmd 1")).to.eql(
                ERROR('wrong # args: should be "cmd a b"')
              );
              expect(execute("proc cmd {a b args} {}; cmd 1")).to.eql(
                ERROR('wrong # args: should be "cmd a b ?arg ...?"')
              );
            });
            specify("too many arguments", () => {
              expect(execute("proc cmd {} {}; cmd 1 2")).to.eql(
                ERROR('wrong # args: should be "cmd"')
              );
              expect(execute("proc cmd {a} {}; cmd 1 2")).to.eql(
                ERROR('wrong # args: should be "cmd a"')
              );
              expect(execute("proc cmd {a {b 1}} {}; cmd 1 2 3")).to.eql(
                ERROR('wrong # args: should be "cmd a ?b?"')
              );
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("proc")).to.eql(
              ERROR('wrong # args: should be "proc name args body"')
            );
            expect(execute("proc a")).to.eql(
              ERROR('wrong # args: should be "proc name args body"')
            );
            expect(execute("proc a b")).to.eql(
              ERROR('wrong # args: should be "proc name args body"')
            );
            expect(execute("proc a b c d")).to.eql(
              ERROR('wrong # args: should be "proc name args body"')
            );
          });
          specify("argument with no name", () => {
            expect(execute("proc cmd {{}} {}")).to.eql(
              ERROR("argument with no name")
            );
            expect(execute("proc cmd {{{} def}} {}")).to.eql(
              ERROR("argument with no name")
            );
          });
          specify("wrong argument specifier format", () => {
            expect(execute("proc cmd {{a b c}} {}")).to.eql(
              ERROR('too many fields in argument specifier "a b c"')
            );
          });
        });
      });
    });
  }
});
