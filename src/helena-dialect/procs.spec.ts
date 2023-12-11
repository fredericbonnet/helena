import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, NIL, STR, StringValue, ValueType } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena procedures", () => {
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
  const example = specifyExample(({ script }) => execute(script));

  beforeEach(init);

  mochadoc.meta({ toc: true });

  describeCommand("proc", () => {
    mochadoc.summary("Create a procedure command");
    mochadoc.usage(usage("proc"));
    mochadoc.description(() => {
      /**
       * The `proc` command creates a new procedure command. The name `proc` was
       * preferred over `procedure` because it is shorter and is already used in
       * Tcl.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help proc")).to.eql(STR("proc ?name? argspec body"));
        expect(evaluate("help proc args")).to.eql(
          STR("proc ?name? argspec body")
        );
        expect(evaluate("help proc args {}")).to.eql(
          STR("proc ?name? argspec body")
        );
        expect(evaluate("help proc cmd args {}")).to.eql(
          STR("proc ?name? argspec body")
        );
      });

      it("should define a new command", () => {
        evaluate("proc cmd {} {}");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("proc cmd {} {}");
        expect(execute("proc cmd {} {}").code).to.eql(ResultCode.OK);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("proc")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
        expect(execute("proc a")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
        expect(execute("proc a b c d")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
        expect(execute("help proc a b c d")).to.eql(
          ERROR('wrong # args: should be "proc ?name? argspec body"')
        );
      });
      specify("invalid `argspec`", () => {
        /**
         * The command expects an argument list in `argspec` format.
         */
        expect(execute("proc a {}")).to.eql(ERROR("invalid argument list"));
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("proc [] {} {}")).to.eql(ERROR("invalid command name"));
      });
      specify("non-script body", () => {
        expect(execute("proc a b")).to.eql(ERROR("body must be a script"));
        expect(execute("proc a b c")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("Metacommand", () => {
      mochadoc.description(() => {
        /**
         * `proc` returns a metacommand value that can be used to introspect
         * the newly created command.
         */
      });

      it("should return a metacommand", () => {
        expect(evaluate("proc {} {}").type).to.eql(ValueType.COMMAND);
        expect(evaluate("proc cmd {} {}").type).to.eql(ValueType.COMMAND);
      });
      specify("the metacommand should return the procedure", () => {
        const value = evaluate("set cmd [proc {val} {idem _${val}_}]");
        expect(evaluate("$cmd").type).to.eql(ValueType.COMMAND);
        expect(evaluate("$cmd")).to.not.eql(value);
        expect(evaluate("[$cmd] arg")).to.eql(STR("_arg_"));
      });

      mochadoc.section("Examples", () => {
        example("Calling procedure through its wrapped metacommand", [
          {
            doc: () => {
              /**
               * Here we create a procedure and call it through its metacommand:
               */
            },
            script: `
              set cmd [proc double {val} {* 2 $val}]
              [$cmd] 3
            `,
            result: INT(6),
          },
          {
            doc: () => {
              /**
               * This behaves the same as calling the procedure directly:
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
            expect(evaluate("[proc {} {}] subcommands")).to.eql(
              evaluate("list (subcommands argspec)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[proc {} {}] subcommands a")).to.eql(
                ERROR('wrong # args: should be "<proc> subcommands"')
              );
            });
          });
        });

        describe("`argspec`", () => {
          example("should return the procedure's argspec", [
            {
              doc: () => {
                /**
                 * Each procedure has an argspec command associated to it,
                 * created with the procedure's `argspec` argument. This
                 * subcommand will return it:
                 */
              },
              script: `
                [proc {a b} {}] argspec
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
              expect(execute("[proc {} {}] argspec a")).to.eql(
                ERROR('wrong # args: should be "<proc> argspec"')
              );
            });
          });
        });

        describe("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute("[proc {} {}] unknownSubcommand")).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute("[proc {} {}] []")).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });
  });

  mochadoc.section("Procedure commands", () => {
    mochadoc.description(() => {
      /**
       * Procedure commands are commands that execute a body script in their
       * own child scope.
       */
    });

    mochadoc.section("Help", () => {
      mochadoc.description(() => {
        /**
         * Procedures have built-in support for `help` generated from their
         * argspec.
         */
      });

      specify("zero", () => {
        evaluate("proc cmd {} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd"));
        expect(execute("help cmd foo")).to.eql(
          ERROR('wrong # args: should be "cmd"')
        );
      });
      specify("one", () => {
        evaluate("proc cmd {a} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a"));
        expect(execute("help cmd foo bar")).to.eql(
          ERROR('wrong # args: should be "cmd a"')
        );
      });
      specify("two", () => {
        evaluate("proc cmd {a b} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a b"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a b"));
        expect(evaluate("help cmd foo bar")).to.eql(STR("cmd a b"));
        expect(execute("help cmd foo bar baz")).to.eql(
          ERROR('wrong # args: should be "cmd a b"')
        );
      });
      specify("optional", () => {
        evaluate("proc cmd {?a} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd ?a?"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd ?a?"));
        expect(execute("help cmd foo bar")).to.eql(
          ERROR('wrong # args: should be "cmd ?a?"')
        );
      });
      specify("remainder", () => {
        evaluate("proc cmd {a *} {}");
        expect(evaluate("help cmd")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo bar")).to.eql(STR("cmd a ?arg ...?"));
        expect(evaluate("help cmd foo bar baz")).to.eql(STR("cmd a ?arg ...?"));
      });
      specify("anonymous", () => {
        evaluate("set cmd [proc {a ?b} {}]");
        expect(evaluate("help [$cmd]")).to.eql(STR("<proc> a ?b?"));
        expect(evaluate("help [$cmd] foo")).to.eql(STR("<proc> a ?b?"));
        expect(evaluate("help [$cmd] foo bar")).to.eql(STR("<proc> a ?b?"));
        expect(execute("help [$cmd] foo bar baz")).to.eql(
          ERROR('wrong # args: should be "<proc> a ?b?"')
        );
      });
    });

    mochadoc.section("Arguments", () => {
      it("should be scope variables", () => {
        evaluate("set var val");
        evaluate("proc cmd {var} {macro cmd2 {} {set var _$var}; cmd2}");
        expect(evaluate("cmd val2")).to.eql(STR("_val2"));
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * The procedure will return an error message with usage when given
           * the wrong number of arguments.
           */
          evaluate("proc cmd {a} {}");
          expect(execute("cmd")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("cmd 1 2")).to.eql(
            ERROR('wrong # args: should be "cmd a"')
          );
          expect(execute("[[proc {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<proc> a"')
          );
          expect(execute("[[proc cmd {a} {}]]")).to.eql(
            ERROR('wrong # args: should be "<proc> a"')
          );
        });
      });
    });

    mochadoc.section("Command calls", () => {
      it("should return nil for empty body", () => {
        evaluate("proc cmd {} {}");
        expect(evaluate("cmd")).to.eql(NIL);
      });
      it("should return the result of the last command", () => {
        evaluate("proc cmd {} {idem val1; idem val2}");
        expect(execute("cmd")).to.eql(OK(STR("val2")));
      });
      it("should evaluate in their own scope", () => {
        evaluate(
          "proc cmd {} {let cst val1; set var val2; macro cmd2 {} {idem val3}; set var [cmd2]}"
        );
        expect(execute("cmd")).to.eql(OK(STR("val3")));
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(rootScope.context.variables.has("var")).to.be.false;
        expect(rootScope.context.commands.has("cmd2")).to.be.false;
      });
      it("should evaluate from their parent scope", () => {
        evaluate("closure cls {} {set var val}");
        evaluate("proc cmd {} {cls}");
        expect(
          evaluate("[scope {closure cls {} {set var val2}}] eval {cmd}")
        ).to.eql(STR("val"));
        expect(evaluate("get var")).to.eql(STR("val"));
      });
      it("should access external commands", () => {
        evaluate("proc cmd {} {idem val}");
        expect(evaluate("cmd")).to.eql(STR("val"));
      });
      it("should not access external variables", () => {
        evaluate("set var val");
        evaluate("proc cmd {} {get var}");
        expect(execute("cmd").code).to.eql(ResultCode.ERROR);
      });
      it("should not set external variables", () => {
        evaluate("set var val");
        evaluate("proc cmd {} {set var val2; let cst val3}");
        evaluate("cmd");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      specify("local commands should shadow external commands", () => {
        evaluate("macro mac {} {idem val}");
        evaluate("proc cmd {} {macro mac {} {idem val2}; mac}");
        expect(evaluate("cmd")).to.eql(STR("val2"));
      });
    });

    mochadoc.section("Return guards", () => {
      mochadoc.description(() => {
        /**
         * Return guards are similar to argspec guards, but apply to the return
         * value of the procedure.
         */
      });

      it("should apply to the return value", () => {
        evaluate('macro guard {result} {idem "guarded:$result"}');
        evaluate("proc cmd1 {var} {return $var}");
        evaluate("proc cmd2 {var} (guard {return $var})");
        expect(evaluate("cmd1 value")).to.eql(STR("value"));
        expect(evaluate("cmd2 value")).to.eql(STR("guarded:value"));
      });
      it("should let body errors pass through", () => {
        evaluate("macro guard {result} {unreachable}");
        evaluate("proc cmd {var} (guard {error msg})");
        expect(execute("cmd value")).to.eql(ERROR("msg"));
      });
      it("should not access proc arguments", () => {
        evaluate("macro guard {result} {exists var}");
        evaluate("proc cmd {var} (guard {return $var})");
        expect(evaluate("cmd value")).to.eql(FALSE);
      });
      it("should evaluate in the proc parent scope", () => {
        evaluate("macro guard {result} {idem root}");
        evaluate("proc cmd {} (guard {true})");
        evaluate("scope scp {macro guard {result} {idem scp}}");
        expect(evaluate("scp eval {cmd}")).to.eql(STR("root"));
      });
      describe("exceptions", () => {
        specify("empty body specifier", () => {
          expect(execute("proc a ()")).to.eql(ERROR("empty body specifier"));
          expect(execute("proc a b ()")).to.eql(ERROR("empty body specifier"));
        });
        specify("invalid body specifier", () => {
          expect(execute("proc a (b c d)")).to.eql(
            ERROR("invalid body specifier")
          );
          expect(execute("proc a b (c d e)")).to.eql(
            ERROR("invalid body specifier")
          );
        });
        specify("non-script body", () => {
          expect(execute("proc a (b c)")).to.eql(
            ERROR("body must be a script")
          );
          expect(execute("proc a b (c d)")).to.eql(
            ERROR("body must be a script")
          );
        });
      });
    });

    mochadoc.section("Control flow", () => {
      mochadoc.description(() => {
        /**
         * The normal return code of a procedure is `OK`. Some codes are handled
         * within the procedure whereas others are propagated to the caller.
         */
      });

      describe("`return`", () => {
        it("should interrupt a proc with `OK` code", () => {
          evaluate("proc cmd {} {return val1; idem val2}");
          expect(execute("cmd")).to.eql(OK(STR("val1")));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt a proc with `OK` code", () => {
          evaluate("proc cmd {} {tailcall (idem val1); idem val2}");
          expect(execute("cmd")).to.eql(OK(STR("val1")));
        });
      });
      describe("`yield`", () => {
        it("should interrupt a proc with `YIELD` code", () => {
          evaluate("proc cmd {} {yield val1; idem val2}");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));
        });
        it("should provide a resumable state", () => {
          evaluate("proc cmd {} {idem _[yield val1]_}");
          const process = rootScope.prepareScript(parse("cmd"));

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("val1"));
          expect(result.data).to.exist;

          process.yieldBack(STR("val2"));
          result = process.run();
          expect(result).to.eql(OK(STR("_val2_")));
        });
        it("should work recursively", () => {
          evaluate("proc cmd1 {} {yield [cmd2]; idem val5}");
          evaluate("proc cmd2 {} {yield [cmd3]; idem [cmd4]}");
          evaluate("proc cmd3 {} {yield val1}");
          evaluate("proc cmd4 {} {yield val3}");
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
        it("should interrupt a proc with `ERROR` code", () => {
          evaluate("proc cmd {} {error msg; idem val}");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("`break`", () => {
        it("should interrupt a proc with `ERROR` code", () => {
          evaluate("proc cmd {} {break; idem val}");
          expect(execute("cmd")).to.eql(ERROR("unexpected break"));
        });
      });
      describe("`continue`", () => {
        it("should interrupt a proc with `ERROR` code", () => {
          evaluate("proc cmd {} {continue; idem val}");
          expect(execute("cmd")).to.eql(ERROR("unexpected continue"));
        });
      });
    });
  });
});
