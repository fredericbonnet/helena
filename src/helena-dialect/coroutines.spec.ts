import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, STR, StringValue, TRUE, ValueType } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena coroutines", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  const init = () => {
    rootScope = new Scope();
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

  describeCommand("coroutine", () => {
    mochadoc.summary("Create a coroutine");
    mochadoc.usage(usage("coroutine"));
    mochadoc.description(() => {
      /**
       * The `coroutine` command creates a coroutine that will execute a body
       * script in its own child scope. Coroutine execution is interruptible and
       * resumable, and can be used for cooperative multitasking.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help coroutine")).to.eql(STR("coroutine body"));
        expect(evaluate("help coroutine body")).to.eql(STR("coroutine body"));
      });

      it("should return a coroutine object", () => {
        expect(evaluate("coroutine {}").type).to.eql(ValueType.COMMAND);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("coroutine")).to.eql(
          ERROR('wrong # args: should be "coroutine body"')
        );
        expect(execute("coroutine a b")).to.eql(
          ERROR('wrong # args: should be "coroutine body"')
        );
        expect(execute("help coroutine a b")).to.eql(
          ERROR('wrong # args: should be "coroutine body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("coroutine a")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("`body`", () => {
      it("should access scope variables", () => {
        evaluate("set var val");
        expect(evaluate("[coroutine {get var}] wait")).to.eql(STR("val"));
      });
      it("should set scope variables", () => {
        evaluate("set var old");
        evaluate("[coroutine {set var val; set var2 val2}] wait");
        expect(evaluate("get var")).to.eql(STR("val"));
        expect(evaluate("get var2")).to.eql(STR("val2"));
      });
      it("should access scope commands", () => {
        evaluate("macro cmd2 {} {set var val}");
        evaluate("macro cmd {} {cmd2}");
        evaluate("[coroutine {cmd}] wait");
        expect(evaluate("get var")).to.eql(STR("val"));
      });

      mochadoc.section("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt the body with `OK` code", () => {
            expect(
              execute("[coroutine {set var val1; return; set var val2}] wait")
                .code
            ).to.eql(ResultCode.OK);
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should return passed value", () => {
            expect(execute("[coroutine {return val}] wait")).to.eql(
              OK(STR("val"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt the body with `OK` code", () => {
            expect(
              execute(
                "[coroutine {set var val1; tailcall {}; set var val2}] wait"
              ).code
            ).to.eql(ResultCode.OK);
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should return passed value", () => {
            expect(execute("[coroutine {tailcall {idem val}}] wait")).to.eql(
              OK(STR("val"))
            );
          });
        });
        describe("`yield`", () => {
          it("should interrupt the body with `OK` code", () => {
            expect(
              execute("[coroutine {set var val1; return; set var val2}] wait")
                .code
            ).to.eql(ResultCode.OK);
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should return yielded value", () => {
            expect(execute("[coroutine {yield val}] wait")).to.eql(
              OK(STR("val"))
            );
          });
          it("should work recursively", () => {
            evaluate("macro cmd1 {} {yield [cmd2]; idem val5}");
            evaluate("macro cmd2 {} {yield [cmd3]; idem [cmd4]}");
            evaluate("macro cmd3 {} {yield val1; idem val2}");
            evaluate("macro cmd4 {} {yield val3; idem val4}");
            evaluate("set cr [coroutine {cmd1}]");
            expect(execute("$cr wait")).to.eql(OK(STR("val1")));
            expect(execute("$cr done")).to.eql(OK(FALSE));
            expect(execute("$cr wait")).to.eql(OK(STR("val2")));
            expect(execute("$cr done")).to.eql(OK(FALSE));
            expect(execute("$cr wait")).to.eql(OK(STR("val3")));
            expect(execute("$cr done")).to.eql(OK(FALSE));
            expect(execute("$cr wait")).to.eql(OK(STR("val4")));
            expect(execute("$cr done")).to.eql(OK(FALSE));
            expect(execute("$cr wait")).to.eql(OK(STR("val5")));
            expect(execute("$cr done")).to.eql(OK(TRUE));
          });
        });
        describe("`error`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(
              execute(
                "[coroutine {set var val1; error msg; set var val2}] wait"
              )
            ).to.eql(ERROR("msg"));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("`break`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(
              execute("[coroutine {set var val1; break; set var val2}] wait")
            ).to.eql(ERROR("unexpected break"));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("`continue`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(
              execute("[coroutine {set var val1; continue; set var val2}] wait")
            ).to.eql(ERROR("unexpected continue"));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
      });
    });

    mochadoc.section("Coroutine object", () => {
      mochadoc.description(() => {
        /**
         * `coroutine` returns a coroutine object value that can be used to
         * control the execution of the coroutine.
         */
      });

      specify("the coroutine object should return itself", () => {
        const value = evaluate("set cr [coroutine {}]");
        expect(evaluate("$cr")).to.eql(value);
      });

      mochadoc.section("Subcommands", () => {
        describe("`subcommands`", () => {
          it("should return list of subcommands", () => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
            expect(evaluate("[coroutine {}] subcommands")).to.eql(
              evaluate("list (subcommands wait active done yield)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The command will return an error message with usage when given the
               * wrong number of arguments.
               */
              expect(execute("[coroutine {}] subcommands a")).to.eql(
                ERROR('wrong # args: should be "<coroutine> subcommands"')
              );
            });
          });
        });
        describe("`wait`", () => {
          it("should evaluate body", () => {
            evaluate("set cr [coroutine {idem val}]");
            expect(evaluate("$cr wait")).to.eql(STR("val"));
          });
          it("should resume yielded body", () => {
            evaluate("set cr [coroutine {yield val1; idem val2}]");
            expect(evaluate("$cr wait")).to.eql(STR("val1"));
            expect(evaluate("$cr wait")).to.eql(STR("val2"));
          });
          it("should return result of completed coroutines", () => {
            evaluate("set cr [coroutine {idem val}]; $cr wait");
            expect(evaluate("$cr wait")).to.eql(STR("val"));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The command will return an error message with usage when given the
               * wrong number of arguments.
               */
              expect(execute("[coroutine {}] wait a")).to.eql(
                ERROR('wrong # args: should be "<coroutine> wait"')
              );
            });
          });
        });
        describe("`active`", () => {
          it("should return `false` on new coroutines", () => {
            evaluate("set cr [coroutine {}]");
            expect(evaluate("$cr active")).to.eql(FALSE);
          });
          it("should return `false` on completed coroutines", () => {
            evaluate("set cr [coroutine {}]");
            evaluate("$cr wait");
            expect(evaluate("$cr active")).to.eql(FALSE);
          });
          it("should return `true` on yielded coroutines", () => {
            evaluate("set cr [coroutine {yield}]");
            evaluate("$cr wait");
            expect(evaluate("$cr active")).to.eql(TRUE);
          });
          it("should return `false` on yielded coroutines ran to completion", () => {
            evaluate("set cr [coroutine {yield}]");
            evaluate("$cr wait");
            evaluate("$cr wait");
            expect(evaluate("$cr active")).to.eql(FALSE);
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The command will return an error message with usage when given the
               * wrong number of arguments.
               */
              expect(execute("[coroutine {}] active a")).to.eql(
                ERROR('wrong # args: should be "<coroutine> active"')
              );
            });
          });
        });
        describe("`done`", () => {
          it("should return `false` on new coroutines", () => {
            evaluate("set cr [coroutine {}]");
            expect(evaluate("$cr done")).to.eql(FALSE);
          });
          it("should return `true` on completed coroutines", () => {
            evaluate("set cr [coroutine {}]");
            evaluate("$cr wait");
            expect(evaluate("$cr done")).to.eql(TRUE);
          });
          it("should return `false` on yielded coroutines", () => {
            evaluate("set cr [coroutine {yield}]");
            evaluate("$cr wait");
            expect(evaluate("$cr done")).to.eql(FALSE);
          });
          it("should return `true` on yielded coroutines ran to completion", () => {
            evaluate("set cr [coroutine {yield}]");
            evaluate("$cr wait");
            evaluate("$cr wait");
            expect(evaluate("$cr done")).to.eql(TRUE);
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The command will return an error message with usage when given the
               * wrong number of arguments.
               */
              expect(execute("[coroutine {}] done a")).to.eql(
                ERROR('wrong # args: should be "<coroutine> done"')
              );
            });
          });
        });
        describe("`yield`", () => {
          it("should resume yielded body", () => {
            evaluate("set cr [coroutine {set var val1; yield; set var val2}]");
            evaluate("$cr wait");
            expect(evaluate("get var")).to.eql(STR("val1"));
            expect(evaluate("$cr yield")).to.eql(STR("val2"));
            expect(evaluate("get var")).to.eql(STR("val2"));
          });
          it("should yield back value to coroutine", () => {
            evaluate("set cr [coroutine {set var [yield]}]");
            evaluate("$cr wait; $cr yield val");
            expect(evaluate("get var")).to.eql(STR("val"));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The command will return an error message with usage when given the
               * wrong number of arguments.
               */
              expect(execute("[coroutine {}] yield a b")).to.eql(
                ERROR('wrong # args: should be "<coroutine> yield ?value?"')
              );
            });
            specify("inactive coroutine", () => {
              evaluate("set cr [coroutine {}]");
              expect(execute("[coroutine {}] yield")).to.eql(
                ERROR("coroutine is inactive")
              );
            });
            specify("completed coroutine", () => {
              evaluate("set cr [coroutine {}]; $cr wait");
              expect(execute("$cr yield")).to.eql(ERROR("coroutine is done"));
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("[coroutine {}] unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("[coroutine {}] []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });
  });
});
