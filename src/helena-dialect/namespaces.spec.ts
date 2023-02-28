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
import { NIL, STR } from "../core/values";
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena namespaces", () => {
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

  describe("namespace", () => {
    it("should define a new command", () => {
      evaluate("namespace cmd {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("namespace cmd {}");
      expect(execute("namespace cmd {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command object", () => {
      expect(evaluate("namespace {}").type).to.eql(commandValueType);
      expect(evaluate("namespace cmd {}").type).to.eql(commandValueType);
    });
    specify("the named command should return its command object", () => {
      const value = evaluate("namespace cmd {}");
      expect(evaluate("cmd")).to.eql(value);
    });
    specify("the command object should return itself", () => {
      const value = evaluate("set cmd [namespace {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("body", () => {
      it("should be executed", () => {
        evaluate("closure cmd {} {let var val}");
        expect(rootScope.context.constants.has("var")).to.be.false;
        evaluate("namespace {cmd}");
        expect(rootScope.context.constants.get("var")).to.eql(STR("val"));
      });
      it("should access global commands", () => {
        expect(execute("namespace {idem val}").code).to.eql(ResultCode.OK);
      });
      it("should not access global variables", () => {
        evaluate("set var val");
        expect(execute("namespace {get var}").code).to.eql(ResultCode.ERROR);
      });
      it("should not set global variables", () => {
        evaluate("set var val");
        evaluate("namespace {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      it("should set namespace variables", () => {
        evaluate("set var val");
        evaluate("namespace cmd {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(evaluate("[cmd] eval {get var}")).to.eql(STR("val2"));
        expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val3"));
      });
      describe("exceptions", () => {
        specify("non-script body", () => {
          expect(execute("namespace a")).to.eql(ERROR("body must be a script"));
          expect(execute("namespace a b")).to.eql(
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
          expect(execute("namespace {cmd1; return; cmd2}").code).to.eql(
            ResultCode.OK
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should still define the named command", () => {
          evaluate("namespace cmd {return}");
          expect(rootScope.context.commands.has("cmd")).to.be.true;
        });
        it("should return passed value instead of the command object", () => {
          expect(execute("namespace {return val}")).to.eql(OK(STR("val")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt the body with OK code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("namespace {cmd1; tailcall {}; cmd2}").code).to.eql(
            ResultCode.OK
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should still define the named command", () => {
          evaluate("namespace cmd {tailcall {}}");
          expect(rootScope.context.commands.has("cmd")).to.be.true;
        });
        it("should return passed value instead of the command object", () => {
          expect(execute("namespace {tailcall {idem val}}")).to.eql(
            OK(STR("val"))
          );
        });
      });
      describe("yield", () => {
        it("should interrupt the body with YIELD code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("namespace cmd {cmd1; yield; cmd2}").code).to.eql(
            ResultCode.YIELD
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {val} {set var $val}");
          const process = rootScope.prepareScript(
            parse("namespace cmd {cmd1; cmd2 _[yield val2]_}")
          );

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val2"));
          expect(result.data).to.exist;

          process.yieldBack(STR("val3"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.OK);
          expect(result.value.type).to.eql(commandValueType);
          expect(evaluate("get var")).to.eql(STR("_val3_"));
        });
        it("should delay the definition of namespace command until resumed", () => {
          const process = rootScope.prepareScript(
            parse("namespace cmd {yield}")
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
          expect(execute("namespace {cmd1; error msg; cmd2}")).to.eql(
            ERROR("msg")
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should not define the namespace command", () => {
          evaluate("namespace cmd {error msg}");
          expect(rootScope.context.commands.has("cmd")).to.be.false;
        });
      });
      describe("break", () => {
        it("should interrupt the body with ERROR code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("namespace {cmd1; break; cmd2}")).to.eql(
            ERROR("unexpected break")
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should not define the namespace command", () => {
          evaluate("namespace cmd {break}");
          expect(rootScope.context.commands.has("cmd")).to.be.false;
        });
      });
      describe("continue", () => {
        it("should interrupt the body with ERROR code", () => {
          evaluate("closure cmd1 {} {set var val1}");
          evaluate("closure cmd2 {} {set var val2}");
          expect(execute("namespace {cmd1; continue; cmd2}")).to.eql(
            ERROR("unexpected continue")
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should not define the namespace command", () => {
          evaluate("namespace cmd {continue}");
          expect(rootScope.context.commands.has("cmd")).to.be.false;
        });
      });
    });
    describe("subcommands", () => {
      describe("subcommands", () => {
        it("should return list of subcommands", () => {
          expect(evaluate("[namespace {}] subcommands")).to.eql(
            evaluate("list (subcommands eval call import)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[namespace {}] subcommands a")).to.eql(
              ERROR('wrong # args: should be "<namespace> subcommands"')
            );
          });
        });
      });
      describe("eval", () => {
        it("should evaluate body in namespace scope", () => {
          evaluate("namespace cmd {let cst val}");
          expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
        });
        it("should accept tuple bodies", () => {
          evaluate("namespace cmd {let cst val}");
          expect(evaluate("[cmd] eval (get cst)")).to.eql(STR("val"));
        });
        it("should evaluate macros in namespace scope", () => {
          evaluate("namespace cmd {macro mac {} {let cst val}}");
          evaluate("[cmd] eval {mac}");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
        });
        it("should evaluate closures in their scope", () => {
          evaluate("closure cls {} {let cst val}");
          evaluate("namespace cmd {}");
          evaluate("[cmd] eval {cls}");
          expect(rootScope.context.constants.get("cst")).to.eql(STR("val"));
          expect(execute("[cmd] eval {get cst}").code).to.eql(ResultCode.ERROR);
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {}");
              expect(execute("[cmd] eval {cmd1; return val3; cmd2}")).to.eql(
                RETURN(STR("val3"))
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("tailcall", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {}");
              expect(
                execute("[cmd] eval {cmd1; tailcall {idem val3}; cmd2}")
              ).to.eql(RETURN(STR("val3")));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("yield", () => {
            it("should interrupt the body with YIELD code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {}");
              expect(execute("[cmd] eval {cmd1; yield; cmd2}").code).to.eql(
                ResultCode.YIELD
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
            it("should provide a resumable state", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {val} {set var $val}");
              evaluate("namespace cmd {}");
              const process = rootScope.prepareScript(
                parse("[cmd] eval {cmd1; cmd2 _[yield val2]_}")
              );

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("val2"));

              process.yieldBack(STR("val3"));
              result = process.run();
              expect(result).to.eql(OK(STR("_val3_")));
              expect(evaluate("get var")).to.eql(STR("_val3_"));
            });
          });
          describe("error", () => {
            it("should interrupt the body with ERROR code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {}");
              expect(execute("[cmd] eval {cmd1; error msg; cmd2}")).to.eql(
                ERROR("msg")
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("break", () => {
            it("should interrupt the body with BREAK code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {}");
              expect(execute("[cmd] eval {cmd1; break; cmd2}")).to.eql(BREAK());
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("continue", () => {
            it("should interrupt the body with CONTINUE code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {}");
              expect(execute("[cmd] eval {cmd1; continue; cmd2}")).to.eql(
                CONTINUE()
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[namespace {}] eval")).to.eql(
              ERROR('wrong # args: should be "<namespace> eval body"')
            );
            expect(execute("[namespace {}] eval a b")).to.eql(
              ERROR('wrong # args: should be "<namespace> eval body"')
            );
          });
          specify("invalid body", () => {
            expect(execute("[namespace {}] eval 1")).to.eql(
              ERROR("body must be a script or tuple")
            );
          });
        });
      });
      describe("call", () => {
        it("should call namespace commands", () => {
          evaluate("namespace cmd {macro mac {} {idem val}}");
          expect(evaluate("[cmd] call mac")).to.eql(STR("val"));
        });
        it("should evaluate macros in namespace", () => {
          evaluate("namespace cmd {macro mac {} {let cst val}}");
          evaluate("[cmd] call mac");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
        });
        it("should evaluate namespace closures in namespace", () => {
          evaluate("namespace cmd {closure cls {} {let cst val}}");
          evaluate("[cmd] call cls");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate(
                "namespace cmd {macro mac {} {cmd1; return val3; cmd2}}"
              );
              expect(execute("[cmd] call mac")).to.eql(RETURN(STR("val3")));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("tailcall", () => {
            it("should interrupt the body with RETURN code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate(
                "namespace cmd {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
              );
              expect(execute("[cmd] call mac")).to.eql(RETURN(STR("val3")));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("yield", () => {
            it("should interrupt the call with YIELD code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {macro mac {} {cmd1; yield; cmd2}}");
              expect(execute("[cmd] call mac").code).to.eql(ResultCode.YIELD);
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
            it("should provide a resumable state", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {val} {set var $val}");
              evaluate("namespace cmd {proc p {} {cmd1; cmd2 _[yield val2]_}}");
              const process = rootScope.prepareScript(parse("[cmd] call p"));

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("val2"));

              process.yieldBack(STR("val3"));
              result = process.run();
              expect(result).to.eql(OK(STR("_val3_")));
              expect(evaluate("get var")).to.eql(STR("_val3_"));
            });
          });
          describe("error", () => {
            it("should interrupt the body with ERROR code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {macro mac {} {cmd1; error msg; cmd2}}");
              expect(execute("[cmd] call mac")).to.eql(ERROR("msg"));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("break", () => {
            it("should interrupt the body with BREAK code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {macro mac {} {cmd1; break; cmd2}}");
              expect(execute("[cmd] call mac")).to.eql(BREAK());
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("continue", () => {
            it("should interrupt the body with CONTINUE code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("namespace cmd {macro mac {} {cmd1; continue; cmd2}}");
              expect(execute("[cmd] call mac")).to.eql(CONTINUE());
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[namespace {}] call")).to.eql(
              ERROR(
                'wrong # args: should be "<namespace> call cmdname ?arg ...?"'
              )
            );
          });
          specify("unknown command", () => {
            expect(execute("[namespace {}] call unknownCommand")).to.eql(
              ERROR('unknown command "unknownCommand"')
            );
          });
          specify("out-of-scope command", () => {
            expect(execute("macro cmd {} {}; [namespace {}] call cmd")).to.eql(
              ERROR('unknown command "cmd"')
            );
          });
          specify("invalid command name", () => {
            expect(execute("[namespace {}] call []")).to.eql(
              ERROR("invalid command name")
            );
          });
        });
      });
      describe("import", () => {
        it("should declare imported commands in the calling scope", () => {
          evaluate(`namespace ns {macro cmd {} {idem value}}`);
          evaluate("[ns] import cmd");
          expect(evaluate("cmd")).to.eql(STR("value"));
        });
        it("should return nil", () => {
          evaluate(`namespace ns {macro cmd {} {idem value}}`);
          expect(execute("[ns] import cmd")).to.eql(OK(NIL));
        });
        it("should replace existing commands", () => {
          evaluate("closure cmd {} {idem val1} ");
          expect(evaluate("cmd")).to.eql(STR("val1"));
          evaluate(`namespace ns {macro cmd {} {idem val2}}`);
          evaluate("[ns] import cmd");
          expect(evaluate("cmd")).to.eql(STR("val2"));
        });
        it("should evaluate macros in the caller scope", () => {
          evaluate(`namespace ns {macro cmd {} {set var val}}`);
          evaluate("[ns] import cmd");
          evaluate("cmd");
          expect(evaluate("get var")).to.eql(STR("val"));
        });
        it("should evaluate closures in their scope", () => {
          evaluate(`namespace ns {set var val; closure cmd {} {get var}}`);
          evaluate("[ns] import cmd");
          expect(evaluate("cmd")).to.eql(STR("val"));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
        it("should resolve imported commands at call time", () => {
          evaluate(`
            namespace ns {
              closure cmd {} {idem val1}
              closure redefine {} {
                closure cmd {} {idem val2}
              }
            }
          `);
          expect(evaluate("[ns] import cmd; cmd")).to.eql(STR("val1"));
          evaluate("ns redefine");
          expect(evaluate("cmd")).to.eql(STR("val1"));
          expect(evaluate("[ns] import cmd; cmd")).to.eql(STR("val2"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[namespace {}] import")).to.eql(
              ERROR('wrong # args: should be "<namespace> import name"')
            );
            expect(execute("[namespace {}] import a b")).to.eql(
              ERROR('wrong # args: should be "<namespace> import name"')
            );
          });
          specify("unresolved command", () => {
            expect(execute("[namespace {}] import a")).to.eql(
              ERROR('cannot resolve imported command "a"')
            );
          });
          specify("invalid import name", () => {
            expect(execute("[namespace {}] import []")).to.eql(
              ERROR("invalid import name")
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("[namespace {}] unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("[namespace {}] []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });
    describe("namespace subcommands", () => {
      it("should map first argument to namespace command name", () => {
        evaluate("namespace cmd {macro opt {} {idem val}}");
        expect(evaluate("cmd opt")).to.eql(STR("val"));
      });
      it("should pass remaining arguments to namespace command", () => {
        evaluate("namespace cmd {macro opt {arg} {idem $arg}}");
        expect(evaluate("cmd opt val")).to.eql(STR("val"));
      });
      it("should evaluate command in namespace scope", () => {
        evaluate("namespace cmd {macro mac {} {let cst val}}");
        evaluate("cmd mac");
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
      });
      it("should work recursively", () => {
        evaluate("namespace ns1 {namespace ns2 {macro opt {} {idem val}}}");
        expect(evaluate("ns1 ns2 opt")).to.eql(STR("val"));
      });
      describe("subcommands", () => {
        it("should return list of subcommands", () => {
          evaluate("namespace cmd {}");
          expect(evaluate("cmd subcommands")).to.eql(
            evaluate("list (subcommands)")
          );
          evaluate("[cmd] eval {macro mac {} {}}");
          expect(evaluate("cmd subcommands")).to.eql(
            evaluate("list (subcommands mac)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            evaluate("namespace cmd {}");
            expect(execute("cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "cmd subcommands"')
            );
          });
        });
      });
      describe("control flow", () => {
        describe("return", () => {
          it("should interrupt the body with RETURN code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("namespace cmd {macro mac {} {cmd1; return val3; cmd2}}");
            expect(execute("cmd mac")).to.eql(RETURN(STR("val3")));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("tailcall", () => {
          it("should interrupt the body with RETURN code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate(
              "namespace cmd {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
            );
            expect(execute("cmd mac")).to.eql(RETURN(STR("val3")));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("yield", () => {
          it("should interrupt the call with YIELD code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("namespace cmd {macro mac {} {cmd1; yield; cmd2}}");
            expect(execute("cmd mac").code).to.eql(ResultCode.YIELD);
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            evaluate("namespace cmd {proc p {} {cmd1; cmd2 _[yield val2]_}}");
            const process = rootScope.prepareScript(parse("cmd p"));

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));

            process.yieldBack(STR("val3"));
            result = process.run();
            expect(result).to.eql(OK(STR("_val3_")));
            expect(evaluate("get var")).to.eql(STR("_val3_"));
          });
        });
        describe("error", () => {
          it("should interrupt the body with ERROR code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("namespace cmd {macro mac {} {cmd1; error msg; cmd2}}");
            expect(execute("cmd mac")).to.eql(ERROR("msg"));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("break", () => {
          it("should interrupt the body with BREAK code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("namespace cmd {macro mac {} {cmd1; break; cmd2}}");
            expect(execute("cmd mac")).to.eql(BREAK());
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("continue", () => {
          it("should interrupt the body with CONTINUE code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("namespace cmd {macro mac {} {cmd1; continue; cmd2}}");
            expect(execute("cmd mac")).to.eql(CONTINUE());
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
      });
      describe("exceptions", () => {
        specify("unknown subcommand", () => {
          evaluate("namespace cmd {}");
          expect(execute("cmd unknownCommand")).to.eql(
            ERROR('unknown subcommand "unknownCommand"')
          );
        });
        specify("out-of-scope subcommand", () => {
          evaluate("macro mac {} {}; namespace cmd {}");
          expect(execute("cmd mac")).to.eql(ERROR('unknown subcommand "mac"'));
        });
        specify("invalid subcommand", () => {
          evaluate("namespace cmd {}");
          expect(execute("cmd []")).to.eql(ERROR("invalid subcommand name"));
        });
      });
    });
    describe("variables", () => {
      it("should map to value keys", () => {
        evaluate("set ns [namespace cmd {let cst val1; set var val2}]");
        expect(evaluate("idem $[cmd](cst)")).to.eql(STR("val1"));
        expect(evaluate("idem $[cmd](var)")).to.eql(STR("val2"));
        expect(evaluate("idem $ns(cst)")).to.eql(STR("val1"));
        expect(evaluate("idem $ns(var)")).to.eql(STR("val2"));
        evaluate("$ns eval {set var2 val3}");
        expect(evaluate("idem $ns(var2)")).to.eql(STR("val3"));
      });
      it("should work recursively", () => {
        evaluate(
          "set ns1 [namespace {set ns2 [namespace {let cst val1; set var val2}]}]"
        );
        expect(evaluate("idem $ns1(ns2)(cst)")).to.eql(STR("val1"));
        expect(evaluate("idem $ns1(ns2)(var)")).to.eql(STR("val2"));
        expect(evaluate("idem $ns1(ns2 cst)")).to.eql(STR("val1"));
        expect(evaluate("idem $ns1(ns2 var)")).to.eql(STR("val2"));
      });
      describe("exceptions", () => {
        specify("unknown variables", () => {
          evaluate("namespace cmd {}");
          expect(execute("$[cmd](unknownVariable)")).to.eql(
            ERROR('cannot get "unknownVariable": no such variable')
          );
        });
        specify("out-of-scope variable", () => {
          evaluate("let cst var; namespace cmd {}");
          expect(execute("$[cmd](cst)")).to.eql(
            ERROR('cannot get "cst": no such variable')
          );
        });
        specify("invalid variable name", () => {
          evaluate("namespace cmd {}");
          expect(execute("$[cmd]([])")).to.eql(ERROR("invalid variable name"));
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("namespace")).to.eql(
          ERROR('wrong # args: should be "namespace ?name? body"')
        );
        expect(execute("namespace a b c")).to.eql(
          ERROR('wrong # args: should be "namespace ?name? body"')
        );
      });
      specify("invalid command name", () => {
        expect(execute("namespace [] {}")).to.eql(
          ERROR("invalid command name")
        );
      });
    });
  });
});
