import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
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
import { STR, StringValue, ValueType } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand } from "./test-helpers";

const asString = (value) => StringValue.toString(value)[1];

describe("Helena scopes", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parseTokens(tokenizer.tokenize(script)).script;
  const prepareScript = (script: string) =>
    rootScope.prepareProcess(rootScope.compile(parse(script)));
  const execute = (script: string) => prepareScript(script).run();
  const evaluate = (script: string) => execute(script).value;

  const init = () => {
    rootScope = Scope.newRootScope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  };
  const usage = (script: string) => {
    init();
    return codeBlock(asString(evaluate("help " + script)));
  };

  beforeEach(init);

  mochadoc.meta({ toc: true });

  describeCommand("scope", () => {
    mochadoc.summary("Create a scope command");
    mochadoc.usage(usage("scope"));
    mochadoc.description(() => {
      /**
       * The `scope` command creates a new command that will encapsulate a child
       * scope.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help scope")).to.eql(STR("scope ?name? body"));
        expect(evaluate("help scope {}")).to.eql(STR("scope ?name? body"));
        expect(evaluate("help scope cmd {}")).to.eql(STR("scope ?name? body"));
      });

      it("should define a new command", () => {
        evaluate("scope cmd {}");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("scope cmd {}");
        expect(execute("scope cmd {}").code).to.eql(ResultCode.OK);
      });
      it("should return a scope value", () => {
        expect(evaluate("scope {}").type).to.eql(ValueType.COMMAND);
        expect(evaluate("scope cmd  {}").type).to.eql(ValueType.COMMAND);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("scope")).to.eql(
          ERROR('wrong # args: should be "scope ?name? body"')
        );
        expect(execute("scope a b c")).to.eql(
          ERROR('wrong # args: should be "scope ?name? body"')
        );
        expect(execute("help scope a b c")).to.eql(
          ERROR('wrong # args: should be "scope ?name? body"')
        );
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("scope [] {}")).to.eql(ERROR("invalid command name"));
      });
      specify("non-script body", () => {
        expect(execute("scope a")).to.eql(ERROR("body must be a script"));
        expect(execute("scope a b")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("`body`", () => {
      it("should be executed", () => {
        evaluate("closure cmd {} {let var val}");
        expect(rootScope.context.constants.has("var")).to.be.false;
        evaluate("scope {cmd}");
        expect(rootScope.context.constants.get("var")).to.eql(STR("val"));
      });
      it("should access global commands", () => {
        expect(execute("scope {idem val}").code).to.eql(ResultCode.OK);
      });
      it("should not access global variables", () => {
        evaluate("set var val");
        expect(execute("scope {get var}").code).to.eql(ResultCode.ERROR);
      });
      it("should not set global variables", () => {
        evaluate("set var val");
        evaluate("scope {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      it("should set scope variables", () => {
        evaluate("set var val");
        evaluate("scope cmd {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(evaluate("cmd eval {get var}")).to.eql(STR("val2"));
        expect(evaluate("cmd eval {get cst}")).to.eql(STR("val3"));
      });

      describe("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If the body returns a result code other than `OK` then it should be
           * propagated properly by the command.
           */
        });

        describe("`return`", () => {
          it("should interrupt the body with `OK` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("scope {cmd1; return; cmd2}").code).to.eql(
              ResultCode.OK
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should still define the named command", () => {
            evaluate("scope cmd {return}");
            expect(rootScope.context.commands.has("cmd")).to.be.true;
          });
          it("should return passed value instead of the command object", () => {
            expect(execute("scope {return val}")).to.eql(OK(STR("val")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt the body with `OK` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("scope {cmd1; tailcall {}; cmd2}").code).to.eql(
              ResultCode.OK
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should still define the named command", () => {
            evaluate("scope cmd {tailcall {}}");
            expect(rootScope.context.commands.has("cmd")).to.be.true;
          });
          it("should return passed value instead of the command object", () => {
            expect(execute("scope {tailcall {idem val}}")).to.eql(
              OK(STR("val"))
            );
          });
        });
        describe("`yield`", () => {
          it("should interrupt the body with `YIELD` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("scope cmd {cmd1; yield; cmd2}").code).to.eql(
              ResultCode.YIELD
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            const process = prepareScript(
              "scope cmd {cmd1; cmd2 _[yield val2]_}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));

            process.yieldBack(STR("val3"));
            result = process.run();
            expect(result.code).to.eql(ResultCode.OK);
            expect(result.value.type).to.eql(ValueType.COMMAND);
            expect(evaluate("get var")).to.eql(STR("_val3_"));
          });
          it("should delay the definition of scope command until resumed", () => {
            const process = prepareScript("scope cmd {yield}");

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(rootScope.context.commands.has("cmd")).to.be.false;

            result = process.run();
            expect(result.code).to.eql(ResultCode.OK);
            expect(rootScope.context.commands.has("cmd")).to.be.true;
          });
        });
        describe("`error`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("scope {cmd1; error msg; cmd2}")).to.eql(
              ERROR("msg")
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should not define the scope command", () => {
            evaluate("scope cmd {error msg}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`break`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("scope {cmd1; break; cmd2}")).to.eql(
              ERROR("unexpected break")
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should not define the scope command", () => {
            evaluate("scope cmd {break}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`continue`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("scope {cmd1; continue; cmd2}")).to.eql(
              ERROR("unexpected continue")
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should not define the scope command", () => {
            evaluate("scope cmd {continue}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
      });
    });

    mochadoc.section("Scope value", () => {
      mochadoc.description(() => {
        /**
         * `scope` returns a scope value that can be passed around and called by
         * value instead of by name.
         */
      });
      mochadoc.usage(usage("[scope {}]"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          evaluate("set cmd [scope cmd {}]");
          expect(evaluate("help cmd")).to.eql(
            STR("cmd ?subcommand? ?arg ...?")
          );
          expect(evaluate("help $cmd")).to.eql(
            STR("<scope> ?subcommand? ?arg ...?")
          );
        });
        specify("calling the scope value should return itself", () => {
          const value = evaluate("set cmd [scope {}]");
          expect(evaluate("$cmd")).to.eql(value);
        });
      });
    });
  });

  mochadoc.section("Scope commands", () => {
    mochadoc.description(() => {
      /**
       * Scope commands are commands that encapsulate a child scope.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        evaluate("set cmd [scope cmd {}]");
        expect(evaluate("help cmd")).to.eql(STR("cmd ?subcommand? ?arg ...?"));
        expect(evaluate("help $cmd")).to.eql(
          STR("<scope> ?subcommand? ?arg ...?")
        );
      });
      it("should return its scope value when called with no argument", () => {
        /**
         * The typical application of this property is to pass around or call
         * the scope command by value.
         */
        const value = evaluate("scope cmd {}");
        expect(evaluate("cmd")).to.eql(value);
      });
    });

    mochadoc.section("Subcommands", () => {
      describe("`subcommands`", () => {
        mochadoc.description(usage("[scope {}] subcommands"));

        it("should return list of subcommands", () => {
          /**
           * This subcommand is useful for introspection and interactive
           * calls.
           */
          expect(evaluate("[scope {}] subcommands")).to.eql(
            evaluate("list (subcommands eval call)")
          );
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            evaluate("set cmd [scope cmd {}]");
            expect(execute("cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "cmd subcommands"')
            );
            expect(execute("$cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "<scope> subcommands"')
            );
            expect(execute("help cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "cmd subcommands"')
            );
            expect(execute("help $cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "<scope> subcommands"')
            );
          });
        });
      });

      describe("`eval`", () => {
        mochadoc.description(usage("[scope {}] eval"));

        it("should evaluate body", () => {
          evaluate("scope cmd {let cst val}");
          expect(evaluate("cmd eval {get cst}")).to.eql(STR("val"));
        });
        it("should accept tuple bodies", () => {
          evaluate("scope cmd {let cst val}");
          expect(evaluate("cmd eval (get cst)")).to.eql(STR("val"));
        });
        it("should evaluate macros in scope", () => {
          evaluate("scope cmd {macro mac {} {let cst val}}");
          evaluate("cmd eval {mac}");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("cmd eval {get cst}")).to.eql(STR("val"));
        });
        it("should evaluate closures in their scope", () => {
          evaluate("closure cls {} {let cst val}");
          evaluate("scope cmd {}");
          evaluate("cmd eval {cls}");
          expect(rootScope.context.constants.get("cst")).to.eql(STR("val"));
          expect(execute("cmd eval {get cst}").code).to.eql(ResultCode.ERROR);
        });

        describe("Control flow", () => {
          describe("`return`", () => {
            it("should interrupt the body with `RETURN` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {}");
              expect(execute("cmd eval {cmd1; return val3; cmd2}")).to.eql(
                RETURN(STR("val3"))
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`tailcall`", () => {
            it("should interrupt the body with `RETURN` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {}");
              expect(
                execute("cmd eval {cmd1; tailcall {idem val3}; cmd2}")
              ).to.eql(RETURN(STR("val3")));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`yield`", () => {
            it("should interrupt the body with `YIELD` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {}");
              expect(execute("cmd eval {cmd1; yield; cmd2}").code).to.eql(
                ResultCode.YIELD
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
            it("should provide a resumable state", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {val} {set var $val}");
              evaluate("scope cmd {}");
              const process = prepareScript(
                "cmd eval {cmd1; cmd2 _[yield val2]_}"
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
          describe("`error`", () => {
            it("should interrupt the body with `ERROR` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {}");
              expect(execute("cmd eval {cmd1; error msg; cmd2}")).to.eql(
                ERROR("msg")
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`break`", () => {
            it("should interrupt the body with `BREAK` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {}");
              expect(execute("cmd eval {cmd1; break; cmd2}")).to.eql(BREAK());
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`continue`", () => {
            it("should interrupt the body with `CONTINUE` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {}");
              expect(execute("cmd eval {cmd1; continue; cmd2}")).to.eql(
                CONTINUE()
              );
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            evaluate("set cmd [scope cmd {}]");
            expect(execute("cmd eval")).to.eql(
              ERROR('wrong # args: should be "cmd eval body"')
            );
            expect(execute("$cmd eval")).to.eql(
              ERROR('wrong # args: should be "<scope> eval body"')
            );
            expect(execute("cmd eval a b")).to.eql(
              ERROR('wrong # args: should be "cmd eval body"')
            );
            expect(execute("$cmd eval a b")).to.eql(
              ERROR('wrong # args: should be "<scope> eval body"')
            );
            expect(execute("help cmd eval a b")).to.eql(
              ERROR('wrong # args: should be "cmd eval body"')
            );
            expect(execute("help $cmd eval a b")).to.eql(
              ERROR('wrong # args: should be "<scope> eval body"')
            );
          });
          specify("invalid body", () => {
            expect(execute("[scope {}] eval 1")).to.eql(
              ERROR("body must be a script or tuple")
            );
          });
        });
      });

      describe("`call`", () => {
        mochadoc.description(usage("[scope {}] call"));

        it("should call scope commands", () => {
          evaluate("scope cmd {macro mac {} {idem val}}");
          expect(evaluate("cmd call mac")).to.eql(STR("val"));
        });
        it("should evaluate macros in scope", () => {
          evaluate("scope cmd {macro mac {} {let cst val}}");
          evaluate("cmd call mac");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("cmd eval {get cst}")).to.eql(STR("val"));
        });
        it("should evaluate closures in scope", () => {
          evaluate("scope cmd {closure cls {} {let cst val}}");
          evaluate("cmd call cls");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(evaluate("cmd eval {get cst}")).to.eql(STR("val"));
        });

        describe("Control flow", () => {
          describe("`return`", () => {
            it("should interrupt the body with `RETURN` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {macro mac {} {cmd1; return val3; cmd2}}");
              expect(execute("cmd call mac")).to.eql(RETURN(STR("val3")));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`tailcall`", () => {
            it("should interrupt the body with `RETURN` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate(
                "scope cmd {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
              );
              expect(execute("cmd call mac")).to.eql(RETURN(STR("val3")));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`yield`", () => {
            it("should interrupt the body with `YIELD` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {macro mac {} {cmd1; yield; cmd2}}");
              expect(execute("cmd call mac").code).to.eql(ResultCode.YIELD);
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
            it("should provide a resumable state", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {val} {set var $val}");
              evaluate("scope cmd {macro mac {} {cmd1; cmd2 _[yield val2]_}}");
              const process = prepareScript("cmd call mac");

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("val2"));

              process.yieldBack(STR("val3"));
              result = process.run();
              expect(result).to.eql(OK(STR("_val3_")));
              expect(evaluate("get var")).to.eql(STR("_val3_"));
            });
          });
          describe("`error`", () => {
            it("should interrupt the body with `ERROR` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {macro mac {} {cmd1; error msg; cmd2}}");
              expect(execute("cmd call mac")).to.eql(ERROR("msg"));
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`break`", () => {
            it("should interrupt the body with `BREAK` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {macro mac {} {cmd1; break; cmd2}}");
              expect(execute("cmd call mac")).to.eql(BREAK());
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
          describe("`continue`", () => {
            it("should interrupt the body with `CONTINUE` code", () => {
              evaluate("closure cmd1 {} {set var val1}");
              evaluate("closure cmd2 {} {set var val2}");
              evaluate("scope cmd {macro mac {} {cmd1; continue; cmd2}}");
              expect(execute("cmd call mac")).to.eql(CONTINUE());
              expect(evaluate("get var")).to.eql(STR("val1"));
            });
          });
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            evaluate("set cmd [scope cmd {}]");
            expect(execute("cmd call")).to.eql(
              ERROR('wrong # args: should be "cmd call cmdname ?arg ...?"')
            );
            expect(execute("$cmd call")).to.eql(
              ERROR('wrong # args: should be "<scope> call cmdname ?arg ...?"')
            );
          });
          specify("unknown command", () => {
            expect(execute("[scope {}] call unknownCommand")).to.eql(
              ERROR('unknown command "unknownCommand"')
            );
          });
          specify("out-of-scope command", () => {
            expect(execute("macro cmd {} {}; [scope {}] call cmd")).to.eql(
              ERROR('unknown command "cmd"')
            );
          });
          specify("invalid command name", () => {
            expect(execute("[scope {}] call []")).to.eql(
              ERROR("invalid command name")
            );
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("[scope {}] unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("[scope {}] []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });
  });
});
