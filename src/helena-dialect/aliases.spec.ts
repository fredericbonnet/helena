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
import { NIL, STR, TUPLE } from "../core/values";
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena aliases", () => {
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

  beforeEach(init);

  const usage = (script: string) => {
    init();
    return "```lna\n" + evaluate("help " + script).asString() + "\n```";
  };
  describe("`alias`", () => {
    mochadoc.summary("Define a command alias");
    mochadoc.usage(usage("alias"));
    mochadoc.description(() => {
      /**
       * The `alias` command defines a new command that is the alias of another
       * command.
       */
    });

    describe("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help alias")).to.eql(STR("alias name command"));
        expect(evaluate("help alias cmd")).to.eql(STR("alias name command"));
        expect(evaluate("help alias cmd cmd2")).to.eql(
          STR("alias name command")
        );
      });

      it("should define a new command", () => {
        evaluate("alias cmd idem");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("alias cmd set");
        expect(execute("alias cmd idem").code).to.eql(ResultCode.OK);
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("alias a")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
        expect(execute("alias a b c")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
        expect(execute("help alias a b c")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
      });
      specify("invalid command name", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("alias [] set")).to.eql(ERROR("invalid command name"));
      });
    });

    describe("Command calls", () => {
      it("should call the aliased command", () => {
        evaluate("macro mac {} {set var val}");
        evaluate("alias cmd mac");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(STR("val"));
      });
      it("should pass arguments to aliased commands", () => {
        evaluate("alias cmd (set var)");
        expect(execute("cmd val")).to.eql(OK(STR("val")));
        expect(evaluate("get var")).to.eql(STR("val"));
      });
      describe("Command tuples", () => {
        mochadoc.description(() => {
          /**
           * Aliased commands can be any type of command, including tuple
           * commands, which are auto-expanded when calling the alias. This can
           * be used for currying or encapsulation, for example:
           *
           * ```lna
           * alias double (* 2)
           * double 3
           * # => 6
           *
           * alias mylist (list (1 2 3))
           * mylist length
           * # => 3
           * ```
           */
        });

        specify("zero", () => {
          evaluate("alias cmd ()");
          expect(execute("cmd")).to.eql(OK(NIL));
          expect(execute("cmd idem val")).to.eql(OK(STR("val")));
        });
        specify("one", () => {
          evaluate("alias cmd return");
          expect(execute("cmd")).to.eql(RETURN());
          expect(execute("cmd val")).to.eql(RETURN(STR("val")));
        });
        specify("two", () => {
          evaluate("alias cmd (idem val)");
          expect(execute("cmd")).to.eql(OK(STR("val")));
        });
        specify("three", () => {
          evaluate("alias cmd (set var val)");
          expect(execute("cmd")).to.eql(OK(STR("val")));
          expect(evaluate("get var")).to.eql(STR("val"));
        });
      });

      describe("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If the aliased command returns a result code then it should be
           * propagated properly by the alias.
           */
        });

        describe("`return`", () => {
          it("should interrupt a macro alias with `RETURN` code", () => {
            evaluate("macro mac {} {return val1; idem val2}");
            evaluate("alias cmd mac");
            expect(execute("cmd")).to.eql(RETURN(STR("val1")));
          });
          it("should interrupt a tuple alias with `RETURN` code", () => {
            evaluate("alias cmd (return val)");
            expect(execute("cmd")).to.eql(RETURN(STR("val")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt a macro alias with `RETURN` code", () => {
            evaluate("macro mac {} {tailcall {idem val1}; idem val2}");
            evaluate("alias cmd mac");
            expect(execute("cmd")).to.eql(RETURN(STR("val1")));
          });
          it("should interrupt a tuple alias with `RETURN` code", () => {
            evaluate("alias cmd (tailcall {idem val})");
            expect(execute("cmd")).to.eql(RETURN(STR("val")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt a macro alias with `YIELD` code", () => {
            evaluate("macro mac {} {yield val1; idem val2}");
            evaluate("alias cmd mac");
            const result = execute("cmd");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
          });
          it("should interrupt a tuple alias with `YIELD` code", () => {
            evaluate("alias cmd (yield val1)");
            const result = execute("cmd");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
          });
          it("should provide a resumable state for macro alias", () => {
            evaluate("macro mac {} {idem _[yield val1]_}");
            evaluate("alias cmd mac");
            const process = rootScope.prepareScript(parse("cmd"));

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));

            process.yieldBack(STR("val2"));
            result = process.run();
            expect(result).to.eql(OK(STR("_val2_")));
          });
          it("should provide a resumable state for tuple alias", () => {
            evaluate("alias cmd (yield val1)");
            const process = rootScope.prepareScript(parse("cmd"));

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            process.yieldBack(STR("val2"));
            result = process.run();
            expect(result).to.eql(OK(STR("val2")));
          });
        });
        describe("`error`", () => {
          it("should interrupt a macro alias with `ERROR` code", () => {
            evaluate("macro mac {} {error msg; idem val}");
            evaluate("alias cmd mac");
            expect(execute("cmd")).to.eql(ERROR("msg"));
          });
          it("should interrupt a tuple alias with `ERROR` code", () => {
            evaluate("alias cmd (error msg)");
            expect(execute("cmd")).to.eql(ERROR("msg"));
          });
        });
        describe("`break`", () => {
          it("should interrupt a macro alias with `BREAK` code", () => {
            evaluate("macro mac {} {break; idem val}");
            evaluate("alias cmd mac");
            expect(execute("cmd")).to.eql(BREAK());
          });
          it("should interrupt a tuple alias with `BREAK` code", () => {
            evaluate("alias cmd (break)");
            expect(execute("cmd")).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt a macro alias with `CONTINUE` code", () => {
            evaluate("macro mac {} {continue; idem val}");
            evaluate("alias cmd mac");
            expect(execute("cmd")).to.eql(CONTINUE());
          });
          it("should interrupt a tuple alias with `CONTINUE` code", () => {
            evaluate("alias cmd (continue)");
            expect(execute("cmd")).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Argument validation is done by the aliased command and
           * propagated properly by the alias.
           */
          evaluate("alias cmd (set var)");
          expect(execute("cmd")).to.eql(
            ERROR('wrong # args: should be "set varname value"')
          );
          expect(execute("cmd 1 2")).to.eql(
            ERROR('wrong # args: should be "set varname value"')
          );
        });
      });
    });

    describe("Metacommand", () => {
      mochadoc.description(() => {
        /**
         * `alias` returns a metacommand value that can be used to introspect
         * the newly created command.
         */
      });

      it("should return a metacommand", () => {
        expect(evaluate("alias cmd idem").type).to.eql(commandValueType);
      });
      specify("the metacommand should return the aliased command", () => {
        /**
         * The typical application of this property is to call the command by
         * wrapping its metacommand within brackets, i.e. `[$metacommand]`:
         *
         * ```lna
         * set cmd [alias foo list]
         * # These sentences yield the same results:
         * list (1 2 3)
         * foo (1 2 3)
         * [$cmd] (1 2 3)
         * ```
         */
        const value = evaluate("set cmd [alias cmd set]");
        expect(evaluate("$cmd").type).to.eql(commandValueType);
        expect(evaluate("$cmd")).to.not.eql(value);
        expect(evaluate("[$cmd] var val")).to.eql(STR("val"));
        expect(evaluate("get var")).to.eql(STR("val"));
      });

      describe("Subcommands", () => {
        describe("`subcommands`", () => {
          it("should return list of subcommands", () => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
            expect(evaluate("[alias cmd idem] subcommands")).to.eql(
              evaluate("list (subcommands command)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[alias cmd idem] subcommands a")).to.eql(
                ERROR('wrong # args: should be "<alias> subcommands"')
              );
            });
          });
        });

        describe("`command`", () => {
          it("should return the aliased command", () => {
            /**
             * This will return the value of the `command` argument.
             */
            evaluate("set cmd [alias cmd (idem val)]");
            expect(evaluate("$cmd command")).to.eql(
              TUPLE([STR("idem"), STR("val")])
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[alias cmd set] command a")).to.eql(
                ERROR('wrong # args: should be "<alias> command"')
              );
            });
          });
        });

        describe("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute("[alias cmd idem] unknownSubcommand")).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute("[alias cmd idem] []")).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });
  });
});
