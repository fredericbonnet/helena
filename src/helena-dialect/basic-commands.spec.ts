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
import {
  CommandValue,
  INT,
  NIL,
  STR,
  StringValue,
  TUPLE,
} from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand } from "./test-helpers";
import { Command } from "../core/commands";

const asString = (value) => StringValue.toString(value)[1];

describe("Helena basic commands", () => {
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

  describeCommand("idem", () => {
    mochadoc.summary("Return the value that is passed to it");
    mochadoc.usage(usage("idem"));
    mochadoc.description(() => {
      /**
       * The `idem` command returns the value that is passed to it. _Idem_ is a
       * latin term meaning "the same".
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help idem")).to.eql(STR("idem value"));
        expect(evaluate("help idem val")).to.eql(STR("idem value"));
      });

      it("should return its `value` argument", () => {
        expect(evaluate("idem val")).to.eql(STR("val"));
        expect(evaluate("idem (a b c)")).to.eql(
          TUPLE([STR("a"), STR("b"), STR("c")])
        );
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("idem")).to.eql(
          ERROR('wrong # args: should be "idem value"')
        );
        expect(execute("idem a b")).to.eql(
          ERROR('wrong # args: should be "idem value"')
        );
        expect(execute("help idem a b")).to.eql(
          ERROR('wrong # args: should be "idem value"')
        );
      });
    });
  });

  describeCommand("return", () => {
    mochadoc.summary("Stop execution with `RETURN` code");
    mochadoc.usage(usage("return"));
    mochadoc.description(() => {
      /**
       * The `return` command is a control flow command that stops the script
       * with a `RETURN` code and an optional result value.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help return")).to.eql(STR("return ?result?"));
        expect(evaluate("help return val")).to.eql(STR("return ?result?"));
      });

      specify("result code should be `RETURN`", () => {
        expect(execute("return").code).to.eql(ResultCode.RETURN);
      });
      it("should return nil by default", () => {
        expect(evaluate("return")).to.eql(NIL);
      });
      it("should return its optional `result` argument", () => {
        expect(evaluate("return val")).to.eql(STR("val"));
      });
      it("should interrupt the script", () => {
        expect(execute("return val; unreachable")).to.eql(RETURN(STR("val")));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("return a b")).to.eql(
          ERROR('wrong # args: should be "return ?result?"')
        );
        expect(execute("help return a b")).to.eql(
          ERROR('wrong # args: should be "return ?result?"')
        );
      });
    });
  });

  describeCommand("tailcall", () => {
    mochadoc.summary("Transfer execution to another script");
    mochadoc.usage(usage("tailcall"));
    mochadoc.description(() => {
      /**
       * The `tailcall` command is a control flow command that stops the script
       * with a `RETURN` code and the evaluated result of another script passed
       * as argument.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help tailcall")).to.eql(STR("tailcall body"));
        expect(evaluate("help tailcall {}")).to.eql(STR("tailcall body"));
      });

      specify("result code should be `RETURN`", () => {
        expect(execute("tailcall {}").code).to.eql(ResultCode.RETURN);
      });
      it("should accept script values for its `body` argument", () => {
        expect(execute("tailcall {}")).to.eql(RETURN(NIL));
      });
      it("should accept tuple values for its `body` argument", () => {
        expect(execute("tailcall ()")).to.eql(RETURN(NIL));
      });
      it("should return the evaluation result of it `body` argument", () => {
        expect(execute("tailcall {idem val}")).to.eql(RETURN(STR("val")));
        expect(execute("tailcall {return val}")).to.eql(RETURN(STR("val")));
        expect(execute("tailcall (idem val); unreachable")).to.eql(
          RETURN(STR("val"))
        );
        expect(execute("tailcall (return val); unreachable")).to.eql(
          RETURN(STR("val"))
        );
      });
      it("should propagate `ERROR` code from `body`", () => {
        expect(execute("tailcall {error msg}")).to.eql(ERROR("msg"));
        expect(execute("tailcall (error msg); unreachable")).to.eql(
          ERROR("msg")
        );
      });
      it("should propagate `BREAK` code from `body`", () => {
        expect(execute("tailcall {break}")).to.eql(BREAK());
        expect(execute("tailcall (break); unreachable")).to.eql(BREAK());
      });
      it("should propagate `CONTINUE` code from `body`", () => {
        expect(execute("tailcall {continue}")).to.eql(CONTINUE());
        expect(execute("tailcall (continue); unreachable")).to.eql(CONTINUE());
      });
      it("should interrupt the script", () => {
        expect(execute("tailcall {idem val}; unreachable")).to.eql(
          RETURN(STR("val"))
        );
        expect(execute("tailcall (idem val); unreachable")).to.eql(
          RETURN(STR("val"))
        );
      });
      it("should work recursively", () => {
        expect(
          execute("tailcall {tailcall (idem val); unreachable}; unreachable")
        ).to.eql(RETURN(STR("val")));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("tailcall")).to.eql(
          ERROR('wrong # args: should be "tailcall body"')
        );
        expect(execute("tailcall a b")).to.eql(
          ERROR('wrong # args: should be "tailcall body"')
        );
        expect(execute("help tailcall a b")).to.eql(
          ERROR('wrong # args: should be "tailcall body"')
        );
      });
      specify("invalid `body`", () => {
        /**
         * The `body` argument must be a script or tuple.
         */
        expect(execute("tailcall 1")).to.eql(
          ERROR("body must be a script or tuple")
        );
      });
    });
  });

  describeCommand("yield", () => {
    mochadoc.summary("Pause execution with `YIELD` code");
    mochadoc.usage(usage("yield"));
    mochadoc.description(() => {
      /**
       * The `yield` command is a control flow command that pauses the script
       * with a `YIELD` code and an optional result value. The script state is
       * saved for later resumability.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help yield")).to.eql(STR("yield ?result?"));
        expect(evaluate("help yield val")).to.eql(STR("yield ?result?"));
      });

      specify("result code should be `YIELD`", () => {
        expect(execute("yield").code).to.eql(ResultCode.YIELD);
      });
      it("should yield nil by default", () => {
        expect(evaluate("yield")).to.eql(NIL);
      });
      it("should yield its optional `result` argument", () => {
        expect(evaluate("yield val")).to.eql(STR("val"));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("yield a b")).to.eql(
          ERROR('wrong # args: should be "yield ?result?"')
        );
        expect(execute("help yield a b")).to.eql(
          ERROR('wrong # args: should be "yield ?result?"')
        );
      });
    });
  });

  describeCommand("error", () => {
    mochadoc.summary("Stop execution with `ERROR` code");
    mochadoc.usage(usage("error"));
    mochadoc.description(() => {
      /**
       * The `yield` command is a control flow command that stops the script
       * with a `ERROR` code and a message value.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help error")).to.eql(STR("error message"));
        expect(evaluate("help error val")).to.eql(STR("error message"));
      });

      specify("result code should be `ERROR`", () => {
        expect(execute("error a").code).to.eql(ResultCode.ERROR);
      });
      specify("result value should be its `message` argument", () => {
        expect(evaluate("error val")).to.eql(STR("val"));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("error")).to.eql(
          ERROR('wrong # args: should be "error message"')
        );
        expect(execute("error a b")).to.eql(
          ERROR('wrong # args: should be "error message"')
        );
        expect(execute("help error a b")).to.eql(
          ERROR('wrong # args: should be "error message"')
        );
      });
      specify("non-string `message`", () => {
        /**
         * Only values with a string representation are accepted as the
         * `message` argument.
         */
        expect(execute("error ()")).to.eql(ERROR("invalid message"));
      });
    });
  });

  describeCommand("break", () => {
    mochadoc.summary("Stop execution with `BREAK` code");
    mochadoc.usage(usage("break"));
    mochadoc.description(() => {
      /**
       * The `yield` command is a control flow command that stops the script
       * with a `BREAK` code.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help break")).to.eql(STR("break"));
      });

      specify("result code should be `BREAK`", () => {
        expect(execute("break").code).to.eql(ResultCode.BREAK);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("break a")).to.eql(
          ERROR('wrong # args: should be "break"')
        );
        expect(execute("help break a")).to.eql(
          ERROR('wrong # args: should be "break"')
        );
      });
    });
  });

  describeCommand("continue", () => {
    mochadoc.summary("Stop execution with `CONTINUE` code");
    mochadoc.usage(usage("continue"));
    mochadoc.description(() => {
      /**
       * The `yield` command is a control flow command that stops the script
       * with a `CONTINUE` code.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help continue")).to.eql(STR("continue"));
      });

      specify("result code should be `CONTINUE`", () => {
        expect(execute("continue").code).to.eql(ResultCode.CONTINUE);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("continue a")).to.eql(
          ERROR('wrong # args: should be "continue"')
        );
        expect(execute("help continue a")).to.eql(
          ERROR('wrong # args: should be "continue"')
        );
      });
    });
  });

  describeCommand("eval", () => {
    mochadoc.summary("Evaluate a script");
    mochadoc.usage(usage("eval"));
    mochadoc.description(() => {
      /**
       * The command `eval` evaluates and returns the result of a Helena script
       * in the current scope.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help eval")).to.eql(STR("eval body"));
        expect(evaluate("help eval body")).to.eql(STR("eval body"));
      });

      it("should return nil for empty `body`", () => {
        expect(evaluate("eval {}")).to.eql(NIL);
      });
      it("should return the result of the last command evaluated in `body`", () => {
        expect(execute("eval {idem val1; idem val2}")).to.eql(OK(STR("val2")));
      });
      it("should evaluate `body` in the current scope", () => {
        evaluate("eval {let var val}");
        expect(evaluate("get var")).to.eql(STR("val"));
      });
      it("should accept tuple `body` arguments", () => {
        expect(evaluate("eval (idem val)")).to.eql(STR("val"));
      });
      it("should work recursively", () => {
        const process = prepareScript(
          "eval {eval {yield val1}; yield val2; eval {yield val3}}"
        );

        let result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val1"));

        result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val2"));

        result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("val3"));

        process.yieldBack(STR("val4"));
        result = process.run();
        expect(result).to.eql(OK(STR("val4")));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("eval")).to.eql(
          ERROR('wrong # args: should be "eval body"')
        );
        expect(execute("eval a b")).to.eql(
          ERROR('wrong # args: should be "eval body"')
        );
        expect(execute("help eval a b")).to.eql(
          ERROR('wrong # args: should be "eval body"')
        );
      });
      specify("invalid `body`", () => {
        /**
         * The `body` argument must be a script or tuple.
         */
        expect(execute("eval 1")).to.eql(
          ERROR("body must be a script or tuple")
        );
      });
    });

    describe("Control flow", () => {
      mochadoc.description(() => {
        /**
         * Control flow commands will interrupt the evaluated script.
         */
      });

      describe("`return`", () => {
        it("should interrupt the body with `RETURN` code", () => {
          expect(
            execute("eval {set var val1; return; set var val2}").code
          ).to.eql(ResultCode.RETURN);
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should return passed value", () => {
          expect(execute("eval {return val}")).to.eql(RETURN(STR("val")));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt the body with `RETURN` code", () => {
          expect(
            execute("eval {set var val1; tailcall {}; set var val2}").code
          ).to.eql(ResultCode.RETURN);
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should return tailcall result", () => {
          expect(execute("eval {tailcall {idem val}}")).to.eql(
            RETURN(STR("val"))
          );
        });
      });
      describe("`yield`", () => {
        it("should interrupt the body with `YIELD` code", () => {
          expect(
            execute("eval {set var val1; yield; set var val2}").code
          ).to.eql(ResultCode.YIELD);
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
        it("should provide a resumable state", () => {
          /**
           * Scripts interrupted with `yield` can be resumed later.
           */
          const process = prepareScript(
            "eval {set var val1; set var _[yield val2]_}"
          );

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val2"));
          expect(evaluate("get var")).to.eql(STR("val1"));

          process.yieldBack(STR("val3"));
          result = process.run();
          expect(result).to.eql(OK(STR("_val3_")));
          expect(evaluate("get var")).to.eql(STR("_val3_"));
        });
      });
      describe("`error`", () => {
        it("should interrupt the body with `ERROR` code", () => {
          expect(
            execute("eval {set var val1; error msg; set var val2}")
          ).to.eql(ERROR("msg"));
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
      });
      describe("`break`", () => {
        it("should interrupt the body with `BREAK` code", () => {
          expect(execute("eval {set var val1; break; set var val2}")).to.eql(
            BREAK()
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
      });
      describe("`continue`", () => {
        it("should interrupt the body with `CONTINUE` code", () => {
          expect(execute("eval {set var val1; continue; set var val2}")).to.eql(
            CONTINUE()
          );
          expect(evaluate("get var")).to.eql(STR("val1"));
        });
      });
    });
  });

  describeCommand("help", () => {
    mochadoc.summary("Give usage of a command");
    mochadoc.usage(usage("help"));
    mochadoc.description(() => {
      /**
       * The `help` command returns a help string for the given command.
       */
    });

    mochadoc.section("Specifications", () => {
      it("should give usage of itself", () => {
        expect(evaluate("help help")).to.eql(STR("help command ?arg ...?"));
      });
      it("should accept optional arguments", () => {
        /** Passing extra arguments will validate the command signature. */
        expect(evaluate("help help command")).to.eql(
          STR("help command ?arg ...?")
        );
      });
      it("should return the command help", () => {
        const command: Command = {
          execute() {
            return OK(NIL);
          },
          help() {
            return OK(STR("this is a help string"));
          },
        };
        rootScope.setNamedConstant("cmd", new CommandValue(command));
        rootScope.registerNamedCommand("cmd", command);
        expect(evaluate("help cmd")).to.eql(STR("this is a help string"));
        expect(evaluate("help $cmd")).to.eql(STR("this is a help string"));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("help")).to.eql(
          ERROR('wrong # args: should be "help command ?arg ...?"')
        );
      });
      specify("invalid `command`", () => {
        /**
         * The `command` argument must either be a command value or have a valid
         * string representation.
         */
        expect(execute("help []")).to.eql(ERROR("invalid command name"));
      });
      specify("unknown command", () => {
        /**
         * The command cannot get help for a non-existing command.
         */
        expect(execute("help unknownCommand")).to.eql(
          ERROR('unknown command "unknownCommand"')
        );
      });
      specify("command with no help", () => {
        /**
         * The command cannot get help for a command that has none.
         */
        const command: Command = {
          execute() {
            return OK(NIL);
          },
        };
        rootScope.setNamedConstant("cmd", new CommandValue(command));
        rootScope.registerNamedCommand("cmd", command);
        expect(execute("help $cmd")).to.eql(ERROR("no help for command"));
        expect(execute("help cmd")).to.eql(ERROR('no help for command "cmd"'));
      });
    });
  });

  describeCommand("^", () => {
    mochadoc.summary("Last result operator");
    mochadoc.usage(codeBlock("^"));
    mochadoc.description(() => {
      /**
       * The `^` command returns the last result of the current script.
       */
    });

    mochadoc.section("Specifications", () => {
      it("should return nil by default", () => {
        expect(evaluate("^")).to.eql(NIL);
      });
      it("should return the last result of the current script", () => {
        expect(evaluate("idem a; ^")).to.eql(STR("a"));
      });
      it("should reset between scripts", () => {
        expect(evaluate("idem a; ^")).to.eql(STR("a"));
        expect(evaluate(" ^")).to.eql(NIL);
      });
      it("should ignore its arguments", () => {
        expect(evaluate("^ a b c")).to.eql(NIL);
      });
    });
  });

  describeCommand(["|>", "pipe"], () => {
    mochadoc.summary("Pipe operator");
    mochadoc.usage(codeBlock("|> ?arg ...?"));
    mochadoc.description(() => {
      /**
       * The pipe operator `|>` passes the result of the previous sentence in
       * the current script to the provided command.
       */
    });

    mochadoc.section("Specifications", () => {
      it("should return nil by default", () => {
        expect(evaluate("|>")).to.eql(NIL);
      });
      it("should return the result of the previous sentence when used with no argument", () => {
        expect(evaluate("string a; |>")).to.eql(STR("a"));
      });
      it("should accept a command as first argument to pipe the result into", () => {
        expect(execute("string a; |> return")).to.eql(RETURN(STR("a")));
      });
      it("should accept extra arguments to pipe after the result", () => {
        expect(evaluate("list (1 2 3); |> list length")).to.eql(INT(3));
      });
      it("should accept tuple commands", () => {
        expect(evaluate("idem length; |> (string foo)")).to.eql(INT(3));
        expect(evaluate("string a; |> (string b append) c")).to.eql(STR("bac"));
      });
      it("should work sequentially", () => {
        expect(evaluate("list (1 2 3); |> list at 2; |> * 5")).to.eql(INT(15));
      });
      it("should reset between scripts", () => {
        expect(evaluate("list (1 2 3); |> list length")).to.eql(INT(3));
        expect(evaluate("|>")).to.eql(NIL);
      });
      it("should not propagate within blocks", () => {
        expect(evaluate("string a; eval {|>}")).to.eql(NIL);
      });
    });
  });
});
