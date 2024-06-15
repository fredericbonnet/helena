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
import { FALSE, INT, NIL, STR, StringValue, ValueType } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena closures", () => {
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
  const example = specifyExample(({ script }) => execute(script));

  beforeEach(init);

  mochadoc.meta({ toc: true });

  describeCommand("closure", () => {
    mochadoc.summary("Create a closure command");
    mochadoc.usage(usage("closure"));
    mochadoc.description(() => {
      /**
       * The `closure` command creates a new closure command.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help closure")).to.eql(
          STR("closure ?name? argspec body")
        );
        expect(evaluate("help closure args")).to.eql(
          STR("closure ?name? argspec body")
        );
        expect(evaluate("help closure args {}")).to.eql(
          STR("closure ?name? argspec body")
        );
        expect(evaluate("help closure cmd args {}")).to.eql(
          STR("closure ?name? argspec body")
        );
      });

      it("should define a new command", () => {
        evaluate("closure cmd {} {}");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("closure cmd {} {}");
        expect(execute("closure cmd {} {}").code).to.eql(ResultCode.OK);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("closure")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
        expect(execute("closure a")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
        expect(execute("closure a b c d")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
        expect(execute("help closure a b c d")).to.eql(
          ERROR('wrong # args: should be "closure ?name? argspec body"')
        );
      });
      specify("invalid `argspec`", () => {
        /**
         * The command expects an argument list in `argspec` format.
         */
        expect(execute("closure a {}")).to.eql(ERROR("invalid argument list"));
        expect(execute("closure cmd a {}")).to.eql(
          ERROR("invalid argument list")
        );
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("closure [] {} {}")).to.eql(
          ERROR("invalid command name")
        );
      });
      specify("non-script body", () => {
        expect(execute("closure a b")).to.eql(ERROR("body must be a script"));
        expect(execute("closure a b c")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("Metacommand", () => {
      mochadoc.description(() => {
        /**
         * `closure` returns a metacommand value that can be used to introspect
         * the newly created command.
         */
      });

      it("should return a metacommand", () => {
        expect(evaluate("closure {} {}").type).to.eql(ValueType.COMMAND);
        expect(evaluate("closure cmd {} {}").type).to.eql(ValueType.COMMAND);
      });
      specify("the metacommand should return the closure", () => {
        /**
         * The typical application of this property is to call the closure by
         * wrapping its metacommand within brackets, e.g. `[$metacommand]`.
         */
        const value = evaluate("set cmd [closure {val} {idem _${val}_}]");
        expect(evaluate("$cmd").type).to.eql(ValueType.COMMAND);
        expect(evaluate("$cmd")).to.not.eql(value);
        expect(evaluate("[$cmd] arg")).to.eql(STR("_arg_"));
      });

      mochadoc.section("Examples", () => {
        example("Calling closure through its wrapped metacommand", [
          {
            doc: () => {
              /**
               * Here we create a closure and call it through its metacommand:
               */
            },
            script: `
              set cmd [closure double {val} {* 2 $val}]
              [$cmd] 3
            `,
            result: INT(6),
          },
          {
            doc: () => {
              /**
               * This behaves the same as calling the closure directly:
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
            expect(evaluate("[closure {} {}] subcommands")).to.eql(
              evaluate("list (subcommands argspec)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[closure {} {}] subcommands a")).to.eql(
                ERROR('wrong # args: should be "<closure> subcommands"')
              );
            });
          });
        });

        describe("`argspec`", () => {
          example("should return the closure's argspec", [
            {
              doc: () => {
                /**
                 * Each closure has an argspec command associated to it, created
                 * with the closure's `argspec` argument. This subcommand will
                 * return it:
                 */
              },
              script: `
                [closure {a b} {}] argspec
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
              expect(execute("[closure {} {}] argspec a")).to.eql(
                ERROR('wrong # args: should be "<closure> argspec"')
              );
            });
          });
        });

        describe("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute("[closure {} {}] unknownSubcommand")).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute("[closure {} {}] []")).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });
  });

  mochadoc.section("Closure commands", () => {
    mochadoc.description(() => {
      /**
       * Closure commands are commands that execute a body script in the scope
       * where they are created.
       */
    });

    mochadoc.section("Help", () => {
      mochadoc.description(() => {
        /**
         * Closures have built-in support for `help` generated from their
         * argspec.
         */
      });

      specify("zero", () => {
        evaluate("closure cmd {} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd"));
        expect(execute("help cmd foo")).to.eql(
          ERROR('wrong # args: should be "cmd"')
        );
      });
      specify("one", () => {
        evaluate("closure cmd {a} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a"));
        expect(execute("help cmd foo bar")).to.eql(
          ERROR('wrong # args: should be "cmd a"')
        );
      });
      specify("two", () => {
        evaluate("closure cmd {a b} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a b"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a b"));
        expect(evaluate("help cmd foo bar")).to.eql(STR("cmd a b"));
        expect(execute("help cmd foo bar baz")).to.eql(
          ERROR('wrong # args: should be "cmd a b"')
        );
      });
      specify("optional", () => {
        evaluate("closure cmd {?a} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd ?a?"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd ?a?"));
        expect(execute("help cmd foo bar")).to.eql(
          ERROR('wrong # args: should be "cmd ?a?"')
        );
      });
      specify("remainder", () => {
        evaluate("closure cmd {a *} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo bar")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo bar baz")).to.eql(STR("cmd a ?arg ...?"));
      });
      specify("anonymous", () => {
        evaluate("set cmd [closure {a ?b} {}]");
        expect(evaluate("help [$cmd]")).to.eql(STR("<closure> a ?b?"));
        expect(evaluate("help [$cmd] foo")).to.eql(STR("<closure> a ?b?"));
        expect(evaluate("help [$cmd] foo bar")).to.eql(STR("<closure> a ?b?"));
        expect(execute("help [$cmd] foo bar baz")).to.eql(
          ERROR('wrong # args: should be "<closure> a ?b?"')
        );
      });
    });

    mochadoc.section("Arguments", () => {
      it("should shadow scope variables", () => {
        evaluate("set var val");
        evaluate("closure cmd {var} {idem $var}");
        expect(evaluate("cmd val2")).to.eql(STR("val2"));
      });
      it("should be closure-local", () => {
        evaluate("set var val");
        evaluate("closure cmd {var} {[[closure {} {idem $var}]]}");
        expect(evaluate("cmd val2")).to.eql(STR("val"));
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * The closure will return an error message with usage when given the
           * wrong number of arguments.
           */
          evaluate("closure cmd {a} {}");
          expect(execute("cmd")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("cmd 1 2")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("[[closure {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<closure> a"')
          );
          expect(execute("[[closure cmd {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<closure> a"')
          );
        });
      });
    });

    mochadoc.section("Command calls", () => {
      it("should return nil for empty body", () => {
        evaluate("closure cmd {} {}");
        expect(evaluate("cmd")).to.eql(NIL);
      });
      it("should return the result of the last command", () => {
        evaluate("closure cmd {} {idem val1; idem val2}");
        expect(execute("cmd")).to.eql(OK(STR("val2")));
      });
      describe("should evaluate in the closure parent scope", () => {
        specify("global scope", () => {
          evaluate(
            "closure cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("cmd");
          expect(rootScope.context.constants.get("cst")).to.eql(STR("val1"));
          expect(rootScope.context.variables.get("var")).to.eql(STR("val2"));
          expect(rootScope.context.commands.has("cmd2")).to.be.true;
        });
        specify("child scope", () => {
          evaluate(
            "closure cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}"
          );
          evaluate("scope scp {cmd}");
          expect(rootScope.context.constants.get("cst")).to.eql(STR("val1"));
          expect(rootScope.context.variables.get("var")).to.eql(STR("val2"));
          expect(rootScope.context.commands.has("cmd2")).to.be.true;
        });
        specify("scoped closure", () => {
          evaluate(
            "scope scp1 {set cmd [closure {} {let cst val1; set var val2; macro cmd2 {} {idem val3}}]}"
          );
          evaluate("scope scp2 {[[scp1 eval {get cmd}]]}");
          expect(evaluate("scp1 eval {get cst}")).to.eql(STR("val1"));
          expect(evaluate("scp1 eval {get var}")).to.eql(STR("val2"));
          expect(evaluate("scp1 eval {cmd2}")).to.eql(STR("val3"));
          expect(execute("scp2 eval {get cst}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp2 eval {get var}").code).to.eql(ResultCode.ERROR);
          expect(execute("scp2 eval {cmd2}").code).to.eql(ResultCode.ERROR);
        });
      });
    });

    mochadoc.section("Return guards", () => {
      mochadoc.description(() => {
        /**
         * Return guards are similar to argspec guards, but apply to the return
         * value of the closure.
         */
      });

      it("should apply to the return value", () => {
        evaluate('macro guard {result} {idem "guarded:$result"}');
        evaluate("closure cmd1 {var} {idem $var}");
        evaluate("closure cmd2 {var} (guard {idem $var})");
        expect(execute("cmd1 value")).to.eql(OK(STR("value")));
        expect(execute("cmd2 value")).to.eql(OK(STR("guarded:value")));
      });
      it("should let body errors pass through", () => {
        evaluate("macro guard {result} {unreachable}");
        evaluate("closure cmd {var} (guard {error msg})");
        expect(execute("cmd value")).to.eql(ERROR("msg"));
      });
      it("should not access closure arguments", () => {
        evaluate("macro guard {result} {exists var}");
        evaluate("closure cmd {var} (guard {idem $var})");
        expect(evaluate("cmd value")).to.eql(FALSE);
      });
      it("should evaluate in the closure parent scope", () => {
        evaluate("macro guard {result} {idem root}");
        evaluate("closure cmd {} (guard {true})");
        evaluate("scope scp {macro guard {result} {idem scp}}");
        expect(evaluate("scp eval {cmd}")).to.eql(STR("root"));
      });

      describe("Exceptions", () => {
        specify("empty body specifier", () => {
          expect(execute("closure a ()")).to.eql(ERROR("empty body specifier"));
          expect(execute("closure a b ()")).to.eql(
            ERROR("empty body specifier")
          );
        });
        specify("invalid body specifier", () => {
          expect(execute("closure a (b c d)")).to.eql(
            ERROR("invalid body specifier")
          );
          expect(execute("closure a b (c d e)")).to.eql(
            ERROR("invalid body specifier")
          );
        });
        specify("non-script body", () => {
          expect(execute("closure a (b c)")).to.eql(
            ERROR("body must be a script")
          );
          expect(execute("closure a b (c d)")).to.eql(
            ERROR("body must be a script")
          );
        });
      });
    });

    mochadoc.section("Control flow", () => {
      mochadoc.description(() => {
        /**
         * If the body returns a result code other than `OK` then it should be
         * propagated properly by the closure to the caller.
         */
      });

      describe("`return`", () => {
        it("should interrupt a closure with `RETURN` code", () => {
          evaluate("closure cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(STR("val1")));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt a closure with `RETURN` code", () => {
          evaluate("closure cmd {} {tailcall {idem val1}; idem val2}");
          expect(execute("cmd")).to.eql(RETURN(STR("val1")));
        });
      });
      describe("`yield`", () => {
        it("should interrupt a closure with `YIELD` code", () => {
          evaluate("closure cmd {} {yield val1; idem val2}");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("closure cmd {} {idem _[yield val1]_}");
          const process = prepareScript("cmd");

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));

          process.yieldBack(STR("val2"));
          result = process.run();
          expect(result).to.eql(OK(STR("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("closure cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("closure cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("closure cmd3 {} {yield val1}");
          evaluate("closure cmd4 {} {yield val3}");
          const process = prepareScript("cmd1");

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
        it("should interrupt a closure with `ERROR` code", () => {
          evaluate("closure cmd {} {error msg; idem val}");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("`break`", () => {
        it("should interrupt a closure with `BREAK` code", () => {
          evaluate("closure cmd {} {break; idem val}");
          expect(execute("cmd")).to.eql(BREAK());
        });
      });
      describe("`continue`", () => {
        it("should interrupt a closure with `CONTINUE` code", () => {
          evaluate("closure cmd {} {continue; idem val}");
          expect(execute("cmd")).to.eql(CONTINUE());
        });
      });
    });
  });
});
