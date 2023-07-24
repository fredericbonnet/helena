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
import { FALSE, INT, NIL, STR } from "../core/values";
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, specifyExample } from "./test-helpers";

describe("Helena macros", () => {
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
    return codeBlock(evaluate("help " + script).asString());
  };
  const example = specifyExample(({ script }) => execute(script));

  beforeEach(init);

  mochadoc.section("`macro`", () => {
    mochadoc.summary("Create a macro command");
    mochadoc.usage(usage("macro"));
    mochadoc.description(() => {
      /**
       * The `macro` command creates a new macro command.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help macro")).to.eql(STR("macro ?name? argspec body"));
        expect(evaluate("help macro args")).to.eql(
          STR("macro ?name? argspec body")
        );
        expect(evaluate("help macro args")).to.eql(
          STR("macro ?name? argspec body")
        );
        expect(evaluate("help macro args {}")).to.eql(
          STR("macro ?name? argspec body")
        );
        expect(evaluate("help macro cmd args {}")).to.eql(
          STR("macro ?name? argspec body")
        );
      });

      it("should define a new command ", () => {
        evaluate("macro cmd {} {}");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("macro cmd {} {}");
        expect(execute("macro cmd {} {}").code).to.eql(ResultCode.OK);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("macro")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
        expect(execute("macro a")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
        expect(execute("macro a b c d")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
        expect(execute("help macro a b c d")).to.eql(
          ERROR('wrong # args: should be "macro ?name? argspec body"')
        );
      });
      specify("invalid `argspec`", () => {
        /**
         * The command expects an argument list in `argspec` format.
         */
        expect(execute("macro a {}")).to.eql(ERROR("invalid argument list"));
        expect(execute("macro cmd a {}")).to.eql(
          ERROR("invalid argument list")
        );
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("macro [] {} {}")).to.eql(ERROR("invalid command name"));
      });
      specify("non-script body", () => {
        expect(execute("macro a b")).to.eql(ERROR("body must be a script"));
        expect(execute("macro a b c")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("Metacommand", () => {
      mochadoc.description(() => {
        /**
         * `macro` returns a metacommand value that can be used to introspect
         * the newly created command.
         */
      });

      it("should return a metacommand", () => {
        expect(evaluate("macro {} {}").type).to.eql(commandValueType);
        expect(evaluate("macro cmd {} {}").type).to.eql(commandValueType);
      });
      specify("the metacommand should return the macro", () => {
        /**
         * The typical application of this property is to call the macro by
         * wrapping its metacommand within brackets, e.g. `[$metacommand]`.
         */
        const value = evaluate("set cmd [macro {val} {idem _${val}_}]");
        expect(evaluate("$cmd").type).to.eql(commandValueType);
        expect(evaluate("$cmd")).to.not.eql(value);
        expect(evaluate("[$cmd] arg")).to.eql(STR("_arg_"));
      });

      mochadoc.section("Examples", () => {
        example("Calling macro through its wrapped metacommand", [
          {
            doc: () => {
              /**
               * Here we create a macro and call it through its metacommand:
               */
            },
            script: `
              set cmd [macro double {val} {* 2 $val}]
              [$cmd] 3
            `,
            result: INT(6),
          },
          {
            doc: () => {
              /**
               * This behaves the same as calling the macro directly:
               */
            },
            script: `
              double 3
            `,
            result: INT(6),
          },
        ]);
      });

      mochadoc.section("Subcommands", () => {
        describe("`subcommands`", () => {
          it("should return list of subcommands", () => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
            expect(evaluate("[macro {} {}] subcommands")).to.eql(
              evaluate("list (subcommands argspec)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[macro {} {}] subcommands a")).to.eql(
                ERROR('wrong # args: should be "<macro> subcommands"')
              );
            });
          });
        });

        describe("`argspec`", () => {
          example("should return the macro's argspec", [
            {
              doc: () => {
                /**
                 * Each macro has an argspec command associated to it, created
                 * with the macro's `argspec` argument. This subcommand will
                 * return it:
                 */
              },
              script: `
                [macro {a b} {}] argspec
              `,
              result: evaluate("argspec {a b}"),
            },
            {
              doc: () => {
                /**
                 * This is identical to:
                 */
              },
              script: `
                argspec {a b}
              `,
            },
          ]);

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[macro {} {}] argspec a")).to.eql(
                ERROR('wrong # args: should be "<macro> argspec"')
              );
            });
          });
        });

        describe("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute("[macro {} {}] unknownSubcommand")).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute("[macro {} {}] []")).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });
  });

  mochadoc.section("Macro commands", () => {
    mochadoc.description(() => {
      /**
       * Macro commands are commands that execute a body script in the calling
       * scope.
       */
    });

    mochadoc.section("Help", () => {
      mochadoc.description(() => {
        /**
         * Macros have built-in support for `help` generated from their
         * argspec.
         */
      });

      specify("zero", () => {
        evaluate("macro cmd {} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd"));
        expect(execute("help cmd foo")).to.eql(
          ERROR('wrong # args: should be "cmd"')
        );
      });
      specify("one", () => {
        evaluate("macro cmd {a} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a"));
        expect(execute("help cmd foo bar")).to.eql(
          ERROR('wrong # args: should be "cmd a"')
        );
      });
      specify("two", () => {
        evaluate("macro cmd {a b} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a b"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a b"));
        expect(evaluate("help cmd foo bar")).to.eql(STR("cmd a b"));
        expect(execute("help cmd foo bar baz")).to.eql(
          ERROR('wrong # args: should be "cmd a b"')
        );
      });
      specify("optional", () => {
        evaluate("macro cmd {?a} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd ?a?"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd ?a?"));
        expect(execute("help cmd foo bar")).to.eql(
          ERROR('wrong # args: should be "cmd ?a?"')
        );
      });
      specify("remainder", () => {
        evaluate("macro cmd {a *} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo bar")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo bar baz")).to.eql(STR("cmd a ?arg ...?"));
      });
    });

    mochadoc.section("Arguments", () => {
      it("should shadow scope variables", () => {
        evaluate("set var val");
        evaluate("macro cmd {var} {idem $var}");
        expect(evaluate("cmd val2")).to.eql(STR("val2"));
      });
      it("should be macro-local", () => {
        evaluate("set var val");
        evaluate("macro cmd {var} {[[macro {} {idem $var}]]}");
        expect(evaluate("cmd val2")).to.eql(STR("val"));
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * The macro will return an error message with usage when given the
           * wrong number of arguments.
           */
          evaluate("macro cmd {a} {}");
          expect(execute("cmd")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("cmd 1 2")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("[[macro {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<macro> a"')
          );
          expect(execute("[[macro cmd {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<macro> a"')
          );
        });
      });
    });

    mochadoc.section("Command calls", () => {
      it("should return nil for empty body", () => {
        evaluate("macro cmd {} {}");
        expect(evaluate("cmd")).to.eql(NIL);
      });
      it("should return the result of the last command", () => {
        evaluate("macro cmd {} {idem val1; idem val2}");
        expect(execute("cmd")).to.eql(OK(STR("val2")));
      });
      describe("should evaluate in the caller scope", () => {
        specify("global scope", () => {
          evaluate(
            "macro cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("cmd");
          expect(rootScope.context.constants.get("cst")).to.eql(STR("val1"));
          expect(rootScope.context.variables.get("var")).to.eql(STR("val2"));
          expect(rootScope.context.commands.has("cmd2")).to.be.true;
        });
        specify("child scope", () => {
          evaluate(
            "macro cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("scope scp {cmd}");
          expect(rootScope.context.constants.has("cst")).to.be.false;
          expect(rootScope.context.variables.has("var")).to.be.false;
          expect(rootScope.context.commands.has("cmd2")).to.be.false;
          expect(evaluate("scp eval {get cst}")).to.eql(STR("val1"));
          expect(evaluate("scp eval {get var}")).to.eql(STR("val2"));
          expect(evaluate("scp eval {cmd2}")).to.eql(STR("val3"));
        });
        specify("scoped macro", () => {
          evaluate(
            "scope scp1 {set cmd [macro {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}]}"
          );
          evaluate("scope scp2 {[[scp1 eval {get cmd}]]}");
          expect(execute("scp1 eval {get cst}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp1 eval {get var}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp1 eval {cmd2}").code).to.eql(ResultCode.ERROR);
          expect(evaluate("scp2 eval {get cst}")).to.eql(STR("val1"));
          expect(evaluate("scp2 eval {get var}")).to.eql(STR("val2"));
          expect(evaluate("scp2 eval {cmd2}")).to.eql(STR("val3"));
        });
      });
      it("should access scope variables", () => {
        evaluate("set var val");
        evaluate("macro cmd {} {get var}");
        expect(evaluate("cmd")).to.eql(STR("val"));
      });
      it("should set scope variables", () => {
        evaluate("set var old");
        evaluate("macro cmd {} {set var val; set var2 val2}");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(STR("val"));
        expect(evaluate("get var2")).to.eql(STR("val2"));
      });
      it("should access scope commands", () => {
        evaluate("macro cmd2 {} {set var val}");
        evaluate("macro cmd {} {cmd2}");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(STR("val"));
      });
    });

    mochadoc.section("Return guards", () => {
      mochadoc.description(() => {
        /**
         * Return guards are similar to argspec guards, but apply to the
         * return value of the macro.
         */
      });

      it("should apply to the return value", () => {
        evaluate('macro guard {result} {idem "guarded:$result"}');
        evaluate("macro cmd1 {var} {idem $var}");
        evaluate("macro cmd2 {var} (guard {idem $var})");
        expect(evaluate("cmd1 value")).to.eql(STR("value"));
        expect(evaluate("cmd2 value")).to.eql(STR("guarded:value"));
      });
      it("should let body errors pass through", () => {
        evaluate("macro guard {result} {unreachable}");
        evaluate("macro cmd {var} (guard {error msg})");
        expect(execute("cmd value")).to.eql(ERROR("msg"));
      });
      it("should not access macro arguments", () => {
        evaluate("macro guard {result} {exists var}");
        evaluate("macro cmd {var} (guard {idem $var})");
        expect(evaluate("cmd value")).to.eql(FALSE);
      });
      it("should evaluate in the caller scope", () => {
        evaluate("macro guard {result} {idem root}");
        evaluate("macro cmd {} (guard {true})");
        evaluate("scope scp {macro guard {result} {idem scp}}");
        expect(evaluate("scp eval {cmd}")).to.eql(STR("scp"));
      });

      describe("Exceptions", () => {
        specify("empty body specifier", () => {
          expect(execute("macro a ()")).to.eql(ERROR("empty body specifier"));
          expect(execute("macro a b ()")).to.eql(ERROR("empty body specifier"));
        });
        specify("invalid body specifier", () => {
          expect(execute("macro a (b c d)")).to.eql(
            ERROR("invalid body specifier")
          );
          expect(execute("macro a b (c d e)")).to.eql(
            ERROR("invalid body specifier")
          );
        });
        specify("non-script body", () => {
          expect(execute("macro a (b c)")).to.eql(
            ERROR("body must be a script")
          );
          expect(execute("macro a b (c d)")).to.eql(
            ERROR("body must be a script")
          );
        });
      });
    });

    mochadoc.section("Control flow", () => {
      mochadoc.description(() => {
        /**
         * If the body returns a result code othen than `OK` then it should be
         * propagated properly by the macro to the caller.
         */
      });

      describe("`return`", () => {
        it("should interrupt a macro with `RETURN` code", () => {
          evaluate("macro cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(STR("val1")));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt a macro with `RETURN` code", () => {
          evaluate("macro cmd {} {tailcall {idem val1}; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(STR("val1")));
        });
      });
      describe("`yield`", () => {
        it("should interrupt a macro with `YIELD` code", () => {
          evaluate("macro cmd {} {yield val1; idem val2}");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("macro cmd {} {idem _[yield val1]_}");
          const process = rootScope.prepareScript(parse("cmd"));

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));

          process.yieldBack(STR("val2"));
          result = process.run();
          expect(result).to.eql(OK(STR("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("macro cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("macro cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("macro cmd3 {} {yield val1}");
          evaluate("macro cmd4 {} {yield val3}");
          const process = rootScope.prepareScript(parse("cmd1"));

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));

          process.yieldBack(STR("val2"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val2"));

          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val3"));

          process.yieldBack(STR("val4"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val4"));

          result = process.run();
          expect(result).to.eql(OK(STR("val5")));
        });
      });
      describe("`error`", () => {
        it("should interrupt a macro with `ERROR` code", () => {
          evaluate("macro cmd {} {error msg; idem val}");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("`break`", () => {
        it("should interrupt a macro with `BREAK` code", () => {
          evaluate("macro cmd {} {break; unreachable}");
          expect(execute("cmd")).to.eql(BREAK());
        });
      });
      describe("`continue`", () => {
        it("should interrupt a macro with `CONTINUE` code", () => {
          evaluate("macro cmd {} {continue; unreachable}");
          expect(execute("cmd")).to.eql(CONTINUE());
        });
      });
    });
  });
});
