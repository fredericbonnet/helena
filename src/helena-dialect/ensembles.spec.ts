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
import { StringValue, TupleValue } from "../core/values";
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena ensembles", () => {
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

  describe("ensemble", () => {
    it("should define a new command", () => {
      evaluate("ensemble cmd {} {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("ensemble cmd {} {}");
      expect(execute("ensemble cmd {} {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("ensemble {} {}").type).to.eql(commandValueType);
      expect(evaluate("ensemble cmd {} {}").type).to.eql(commandValueType);
    });
    specify("command should return self", () => {
      const value = evaluate("ensemble cmd {} {}");
      expect(evaluate("cmd")).to.eql(value);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [ensemble {} {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("body", () => {
      it("should be executed", () => {
        evaluate("closure cmd {} {let var val}");
        expect(rootScope.context.constants.has("var")).to.be.false;
        evaluate("ensemble {} {cmd}");
        expect(rootScope.context.constants.get("var")).to.eql(
          new StringValue("val")
        );
      });
      it("should access global commands", () => {
        expect(execute("ensemble {} {idem val}").code).to.eql(ResultCode.OK);
      });
      it("should not access global variables", () => {
        evaluate("set var val");
        expect(execute("ensemble {} {get var}").code).to.eql(ResultCode.ERROR);
      });
      it("should not set global variables", () => {
        evaluate("set var val");
        evaluate("ensemble {} {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(
          new StringValue("val")
        );
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      it("should set ensemble variables", () => {
        evaluate("set var val");
        evaluate("ensemble cmd {} {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(
          new StringValue("val")
        );
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(evaluate("[cmd] eval {get var}")).to.eql(
          new StringValue("val2")
        );
        expect(evaluate("[cmd] eval {get cst}")).to.eql(
          new StringValue("val3")
        );
      });
      describe("exceptions", () => {
        specify("non-script body", () => {
          expect(execute("ensemble {} a")).to.eql(
            ERROR("body must be a script")
          );
          expect(execute("ensemble a {} b")).to.eql(
            ERROR("body must be a script")
          );
        });
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt the body with OK code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("ensemble {} {cmd1; return; cmd2}").code).to.eql(
            ResultCode.OK
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should still define the ensemble command", () => {
          evaluate("ensemble cmd {} {return}");
          expect(rootScope.context.commands.has("cmd")).to.be.true;
        });
        it("should return passed value instead of ensemble command value", () => {
          expect(execute("ensemble {} {return val}")).to.eql(
            OK(new StringValue("val"))
          );
        });
      });
      describe("tailcall", () => {
        it("should interrupt the body with OK code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("ensemble {} {cmd1; tailcall {}; cmd2}").code).to.eql(
            ResultCode.OK
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should still define the ensemble command", () => {
          evaluate("ensemble cmd {} {tailcall {}}");
          expect(rootScope.context.commands.has("cmd")).to.be.true;
        });
        it("should return passed value instead of ensemble command value", () => {
          expect(execute("ensemble {} {tailcall {idem val}}")).to.eql(
            OK(new StringValue("val"))
          );
        });
      });
      describe("yield", () => {
        it("should interrupt the body with YIELD code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("ensemble cmd {} {cmd1; yield; cmd2}").code).to.eql(
            ResultCode.YIELD
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {val} {set var $val}");
          const process = rootScope.prepareScript(
            parse("ensemble cmd {} {cmd1; cmd2 _[yield val2]_}")
          );

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val2"));
          expect(result.data).to.exist;

          process.yieldBack(new StringValue("val3"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.OK);
          expect(result.value.type).to.eql(commandValueType);
          expect(evaluate("get var")).to.eql(new StringValue("_val3_"));
        });
        it("should delay the definition of ensemble command until resumed", () => {
          const process = rootScope.prepareScript(
            parse("ensemble cmd {} {yield}")
          );

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(rootScope.context.commands.has("cmd")).to.be.false;

          result = process.run();
          expect(result.code).to.eql(ResultCode.OK);
          expect(rootScope.context.commands.has("cmd")).to.be.true;
        });
      });
      describe("error", () => {
        it("should interrupt the body with ERROR code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("ensemble {} {cmd1; error msg; cmd2}")).to.eql(
            ERROR("msg")
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should not define the ensemble command", () => {
          evaluate("ensemble cmd {} {error msg}");
          expect(rootScope.context.commands.has("cmd")).to.be.false;
        });
      });
      describe("break", () => {
        it("should interrupt the body with ERROR code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("ensemble {} {cmd1; break; cmd2}")).to.eql(
            ERROR("unexpected break")
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should not define the ensemble command", () => {
          evaluate("ensemble cmd {} {break}");
          expect(rootScope.context.commands.has("cmd")).to.be.false;
        });
      });
      describe("continue", () => {
        it("should interrupt the body with ERROR code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("ensemble {} {cmd1; continue; cmd2}")).to.eql(
            ERROR("unexpected continue")
          );
          expect(evaluate("get var")).to.eql(new StringValue("val1"));
        });
        it("should not define the ensemble command", () => {
          evaluate("ensemble cmd {} {continue}");
          expect(rootScope.context.commands.has("cmd")).to.be.false;
        });
      });
    });
    describe("methods", () => {
      describe("argspec", () => {
        it("should return the ensemble argspec", () => {
          expect(evaluate("[ensemble {a b} {}] argspec")).to.eql(
            evaluate("argspec {a b}")
          );
        });
        describe("exceptions", () => {
          specify("invalid value", () => {
            expect(execute("ensemble a {}")).to.eql(
              ERROR("invalid argument list")
            );
          });
          specify("variadic arguments", () => {
            expect(execute("ensemble {?a} {}")).to.eql(
              ERROR("ensemble arguments cannot be variadic")
            );
            expect(execute("ensemble {*a} {}")).to.eql(
              ERROR("ensemble arguments cannot be variadic")
            );
          });
        });
      });
      describe("eval", () => {
        it("should evaluate body in ensemble scope", () => {
          evaluate("ensemble cmd {} {let cst val}");
          expect(evaluate("[cmd] eval {get cst}")).to.eql(
            new StringValue("val")
          );
        });
        it("should accept tuple bodies", () => {
          evaluate("ensemble cmd {} {let cst val}");
          expect(evaluate("[cmd] eval (get cst)")).to.eql(
            new StringValue("val")
          );
        });
        it("should evaluate macros in ensemble scope", () => {
          evaluate("ensemble cmd {} {macro mac {} {let cst val}}");
          evaluate("[cmd] eval {mac}");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("[cmd] eval {get cst}")).to.eql(
            new StringValue("val")
          );
        });
        it("should evaluate closures in their scope", () => {
          evaluate("closure cls {} {let cst val}");
          evaluate("ensemble cmd {} {}");
          evaluate("[cmd] eval {cls}");
          expect(rootScope.context.constants.get("cst")).to.eql(
            new StringValue("val")
          );
          expect(execute("[cmd] eval {get cst}").code).to.eql(ResultCode.ERROR);
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {}");
              expect(execute("[cmd] eval {cmd1; return val3; cmd2}")).to.eql(
                RETURN(new StringValue("val3"))
              );
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("tailcall", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {}");
              expect(
                execute("[cmd] eval {cmd1; tailcall {idem val3}; cmd2}")
              ).to.eql(RETURN(new StringValue("val3")));
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("yield", () => {
            it("should interrupt the body with YIELD code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {}");
              expect(execute("[cmd] eval {cmd1; yield; cmd2}").code).to.eql(
                ResultCode.YIELD
              );
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
            it("should provide a resumable state", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {val} {set var $val}");
              evaluate("ensemble cmd {} {}");
              const process = rootScope.prepareScript(
                parse("[cmd] eval {cmd1; cmd2 _[yield val2]_}")
              );

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("val2"));

              process.yieldBack(new StringValue("val3"));
              result = process.run();
              expect(result).to.eql(OK(new StringValue("_val3_")));
              expect(evaluate("get var")).to.eql(new StringValue("_val3_"));
            });
          });
          describe("error", () => {
            it("should interrupt the body with ERROR code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {}");
              expect(execute("[cmd] eval {cmd1; error msg; cmd2}")).to.eql(
                ERROR("msg")
              );
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("break", () => {
            it("should interrupt the body with BREAK code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {}");
              expect(execute("[cmd] eval {cmd1; break; cmd2}")).to.eql(BREAK());
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("continue", () => {
            it("should interrupt the body with CONTINUE code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {}");
              expect(execute("[cmd] eval {cmd1; continue; cmd2}")).to.eql(
                CONTINUE()
              );
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[ensemble {} {}] eval")).to.eql(
              ERROR('wrong # args: should be "<ensemble> eval body"')
            );
            expect(execute("[ensemble {} {}] eval a b")).to.eql(
              ERROR('wrong # args: should be "<ensemble> eval body"')
            );
          });
          specify("invalid body", () => {
            expect(execute("[ensemble {} {}] eval 1")).to.eql(
              ERROR("body must be a script or tuple")
            );
          });
        });
      });
      describe("call", () => {
        it("should call ensemble commands", () => {
          evaluate("ensemble cmd {} {macro mac {} {idem val}}");
          expect(evaluate("[cmd] call mac")).to.eql(new StringValue("val"));
        });
        it("should evaluate macros in the caller scope", () => {
          evaluate("ensemble cmd {} {macro mac {} {let cst val}}");
          evaluate("[cmd] call mac");
          expect(rootScope.context.constants.get("cst")).to.eql(
            new StringValue("val")
          );
          evaluate("scope scp {[cmd] call mac}");
          expect(evaluate("[scp] eval {get cst}")).to.eql(
            new StringValue("val")
          );
        });
        it("should evaluate ensemble closures in ensemble scope", () => {
          evaluate("ensemble cmd {} {closure cls {} {let cst val}}");
          evaluate("[cmd] call cls");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("[cmd] eval {get cst}")).to.eql(
            new StringValue("val")
          );
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate(
                "ensemble cmd {} {macro mac {} {cmd1; return val3; cmd2}}"
              );
              expect(execute("[cmd] call mac")).to.eql(
                RETURN(new StringValue("val3"))
              );
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("tailcall", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate(
                "ensemble cmd {} {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
              );
              expect(execute("[cmd] call mac")).to.eql(
                RETURN(new StringValue("val3"))
              );
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("yield", () => {
            it("should interrupt the call with YIELD code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {macro mac {} {cmd1; yield; cmd2}}");
              expect(execute("[cmd] call mac").code).to.eql(ResultCode.YIELD);
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
            it("should provide a resumable state", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {val} {set var $val}");
              evaluate(
                "ensemble cmd {} {proc p {} {cmd1; cmd2 _[yield val2]_}}"
              );
              const process = rootScope.prepareScript(parse("[cmd] call p"));

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("val2"));

              process.yieldBack(new StringValue("val3"));
              result = process.run();
              expect(result).to.eql(OK(new StringValue("_val3_")));
              expect(evaluate("get var")).to.eql(new StringValue("_val3_"));
            });
          });
          describe("error", () => {
            it("should interrupt the body with ERROR code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate(
                "ensemble cmd {} {macro mac {} {cmd1; error msg; cmd2}}"
              );
              expect(execute("[cmd] call mac")).to.eql(ERROR("msg"));
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("break", () => {
            it("should interrupt the body with BREAK code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {macro mac {} {cmd1; break; cmd2}}");
              expect(execute("[cmd] call mac")).to.eql(BREAK());
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
          describe("continue", () => {
            it("should interrupt the body with CONTINUE code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("ensemble cmd {} {macro mac {} {cmd1; continue; cmd2}}");
              expect(execute("[cmd] call mac")).to.eql(CONTINUE());
              expect(evaluate("get var")).to.eql(new StringValue("val1"));
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[ensemble {} {}] call")).to.eql(
              ERROR(
                'wrong # args: should be "<ensemble> call cmdname ?arg ...?"'
              )
            );
          });
          specify("non-existing command", () => {
            expect(execute("[ensemble {} {}] call unknownCommand")).to.eql(
              ERROR('invalid command name "unknownCommand"')
            );
          });
          specify("out-of-scope command", () => {
            expect(
              execute("macro cmd {} {}; [ensemble {} {}] call cmd")
            ).to.eql(ERROR('invalid command name "cmd"'));
          });
          specify("invalid command name", () => {
            expect(execute("[ensemble {} {}] call []")).to.eql(
              ERROR("invalid command name")
            );
          });
        });
      });
      describe("argspec", () => {
        it("should return the ensemble argspec", () => {
          expect(evaluate("[ensemble {a b} {}] argspec")).to.eql(
            evaluate("argspec {a b}")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[ensemble {} {}] argspec a")).to.eql(
              ERROR('wrong # args: should be "<ensemble> argspec"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[ensemble {} {}] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("subcommands", () => {
      specify("when missing should return ensemble arguments tuple", () => {
        evaluate("ensemble cmd {a b} {macro opt {a b} {idem val}}");
        expect(evaluate("cmd foo bar")).to.eql(
          new TupleValue([new StringValue("foo"), new StringValue("bar")])
        );
      });
      specify(
        "first argument after ensemble arguments should be ensemble command name",
        () => {
          evaluate("ensemble cmd {a b} {macro opt {a b} {idem val}}");
          expect(evaluate("cmd foo bar opt")).to.eql(new StringValue("val"));
        }
      );
      it("should pass ensemble arguments to ensemble command", () => {
        evaluate("ensemble cmd {a b} {macro opt {a b} {idem $a$b}}");
        expect(evaluate("cmd foo bar opt")).to.eql(new StringValue("foobar"));
      });
      it("should pass remaining arguments to ensemble command", () => {
        evaluate("ensemble cmd {a b} {macro opt {a b c d} {idem $a$b$c$d}}");
        expect(evaluate("cmd foo bar opt baz sprong")).to.eql(
          new StringValue("foobarbazsprong")
        );
      });
      it("should evaluate command in the caller scope", () => {
        evaluate("ensemble cmd {} {macro mac {} {let cst val}}");
        evaluate("cmd mac");
        expect(rootScope.context.constants.get("cst")).to.eql(
          new StringValue("val")
        );
        evaluate("scope scp {cmd mac}");
        expect(evaluate("[scp] eval {get cst}")).to.eql(new StringValue("val"));
      });
      it("should work recursively", () => {
        evaluate(
          "ensemble en1 {a b} {ensemble en2 {a b c d} {macro opt {a b c d e f} {idem $a$b$c$d$e$f}}}"
        );
        expect(evaluate("en1 foo bar en2 baz sprong opt val1 val2")).to.eql(
          new StringValue("foobarbazsprongval1val2")
        );
      });
      describe("control flow", () => {
        describe("return", () => {
          it("should interrupt the body with RETURN code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate(
              "ensemble cmd {} {macro mac {} {cmd1; return val3; cmd2}}"
            );
            expect(execute("cmd mac")).to.eql(RETURN(new StringValue("val3")));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("tailcall", () => {
          it("should interrupt the body with RETURN code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate(
              "ensemble cmd {} {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
            );
            expect(execute("cmd mac")).to.eql(RETURN(new StringValue("val3")));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("yield", () => {
          it("should interrupt the call with YIELD code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; yield; cmd2}}");
            expect(execute("cmd mac").code).to.eql(ResultCode.YIELD);
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            evaluate("ensemble cmd {} {proc p {} {cmd1; cmd2 _[yield val2]_}}");
            const process = rootScope.prepareScript(parse("cmd p"));

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("val2"));

            process.yieldBack(new StringValue("val3"));
            result = process.run();
            expect(result).to.eql(OK(new StringValue("_val3_")));
            expect(evaluate("get var")).to.eql(new StringValue("_val3_"));
          });
        });
        describe("error", () => {
          it("should interrupt the body with ERROR code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; error msg; cmd2}}");
            expect(execute("cmd mac")).to.eql(ERROR("msg"));
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("break", () => {
          it("should interrupt the body with BREAK code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; break; cmd2}}");
            expect(execute("cmd mac")).to.eql(BREAK());
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
        describe("continue", () => {
          it("should interrupt the body with CONTINUE code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; continue; cmd2}}");
            expect(execute("cmd mac")).to.eql(CONTINUE());
            expect(evaluate("get var")).to.eql(new StringValue("val1"));
          });
        });
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
          evaluate("ensemble cmd {a b} {}");
          expect(execute("cmd a")).to.eql(
            ERROR('wrong # args: should be "cmd a b ?cmdname? ?arg ...?"')
          );
        });
        specify("non-existing subcommand", () => {
          evaluate("ensemble cmd {} {}");
          expect(execute("cmd unknownCommand")).to.eql(
            ERROR('invalid subcommand name "unknownCommand"')
          );
        });
        specify("out-of-scope subcommand", () => {
          evaluate("macro mac {} {}; ensemble cmd {} {}");
          expect(execute("cmd mac")).to.eql(
            ERROR('invalid subcommand name "mac"')
          );
        });
        specify("invalid subcommand", () => {
          evaluate("ensemble cmd {} {}");
          expect(execute("cmd []")).to.eql(ERROR("invalid subcommand name"));
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("ensemble a")).to.eql(
          ERROR('wrong # args: should be "ensemble ?name? argspec body"')
        );
        expect(execute("ensemble a b c d")).to.eql(
          ERROR('wrong # args: should be "ensemble ?name? argspec body"')
        );
      });
      specify("invalid command name", () => {
        expect(execute("ensemble [] {} {}")).to.eql(
          ERROR("invalid command name")
        );
      });
    });
  });
});
