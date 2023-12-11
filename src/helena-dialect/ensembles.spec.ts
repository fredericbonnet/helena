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
  INT,
  LIST,
  NIL,
  STR,
  StringValue,
  TUPLE,
  ValueType,
} from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena ensembles", () => {
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

  describeCommand("ensemble", () => {
    mochadoc.summary("Create an ensemble command");
    mochadoc.usage(usage("ensemble"));
    mochadoc.description(() => {
      /**
       * The `ensemble` command creates a new ensemble command.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help ensemble")).to.eql(
          STR("ensemble ?name? argspec body")
        );
        expect(evaluate("help ensemble {}")).to.eql(
          STR("ensemble ?name? argspec body")
        );
        expect(evaluate("help ensemble cmd {}")).to.eql(
          STR("ensemble ?name? argspec body")
        );
      });

      it("should define a new command", () => {
        evaluate("ensemble cmd {} {}");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("ensemble cmd {} {}");
        expect(execute("ensemble cmd {} {}").code).to.eql(ResultCode.OK);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("ensemble a")).to.eql(
          ERROR('wrong # args: should be "ensemble ?name? argspec body"')
        );
        expect(execute("ensemble a b c d")).to.eql(
          ERROR('wrong # args: should be "ensemble ?name? argspec body"')
        );
        expect(execute("help ensemble a b c d")).to.eql(
          ERROR('wrong # args: should be "ensemble ?name? argspec body"')
        );
      });
      specify("invalid `argspec`", () => {
        /**
         * The command expects an argument list in `argspec` format.
         */
        expect(execute("ensemble a {}")).to.eql(ERROR("invalid argument list"));
      });
      specify("variadic arguments", () => {
        /**
         * Ensemble argument lists are fixed-length; optional or remainder
         * arguments are forbidden.
         */
        expect(execute("ensemble {?a} {}")).to.eql(
          ERROR("ensemble arguments cannot be variadic")
        );
        expect(execute("ensemble {*a} {}")).to.eql(
          ERROR("ensemble arguments cannot be variadic")
        );
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("ensemble [] {} {}")).to.eql(
          ERROR("invalid command name")
        );
      });
      specify("non-script body", () => {
        expect(execute("ensemble {} a")).to.eql(ERROR("body must be a script"));
        expect(execute("ensemble a {} b")).to.eql(
          ERROR("body must be a script")
        );
      });
    });

    mochadoc.section("`body`", () => {
      it("should be executed", () => {
        evaluate("closure cmd {} {let var val}");
        expect(rootScope.context.constants.has("var")).to.be.false;
        evaluate("ensemble {} {cmd}");
        expect(rootScope.context.constants.get("var")).to.eql(STR("val"));
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
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      it("should set ensemble variables", () => {
        evaluate("set var val");
        evaluate("ensemble cmd {} {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
        expect(evaluate("[cmd] eval {get var}")).to.eql(STR("val2"));
        expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val3"));
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
            expect(execute("ensemble {} {cmd1; return; cmd2}").code).to.eql(
              ResultCode.OK
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should still define the named command", () => {
            evaluate("ensemble cmd {} {return}");
            expect(rootScope.context.commands.has("cmd")).to.be.true;
          });
          it("should return passed value instead of the command object", () => {
            expect(execute("ensemble {} {return val}")).to.eql(OK(STR("val")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt the body with `OK` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(
              execute("ensemble {} {cmd1; tailcall {}; cmd2}").code
            ).to.eql(ResultCode.OK);
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should still define the named command", () => {
            evaluate("ensemble cmd {} {tailcall {}}");
            expect(rootScope.context.commands.has("cmd")).to.be.true;
          });
          it("should return passed value instead of the command object", () => {
            expect(execute("ensemble {} {tailcall {idem val}}")).to.eql(
              OK(STR("val"))
            );
          });
        });
        describe("`yield`", () => {
          it("should interrupt the body with `YIELD` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("ensemble cmd {} {cmd1; yield; cmd2}").code).to.eql(
              ResultCode.YIELD
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            const process = rootScope.prepareScript(
              parse("ensemble cmd {} {cmd1; cmd2 _[yield val2]_}")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(STR("val3"));
            result = process.run();
            expect(result.code).to.eql(ResultCode.OK);
            expect(result.value.type).to.eql(ValueType.COMMAND);
            expect(evaluate("get var")).to.eql(STR("_val3_"));
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
        describe("`error`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("ensemble {} {cmd1; error msg; cmd2}")).to.eql(
              ERROR("msg")
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should not define the ensemble command", () => {
            evaluate("ensemble cmd {} {error msg}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`break`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("ensemble {} {cmd1; break; cmd2}")).to.eql(
              ERROR("unexpected break")
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should not define the ensemble command", () => {
            evaluate("ensemble cmd {} {break}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`continue`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            expect(execute("ensemble {} {cmd1; continue; cmd2}")).to.eql(
              ERROR("unexpected continue")
            );
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should not define the ensemble command", () => {
            evaluate("ensemble cmd {} {continue}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
      });
    });

    mochadoc.section("Metacommand", () => {
      mochadoc.description(() => {
        /**
         * `ensemble` returns a metacommand value that can be used to introspect
         * the newly created command.
         */
      });

      it("should return a metacommand", () => {
        expect(evaluate("ensemble {} {}").type).to.eql(ValueType.COMMAND);
        expect(evaluate("ensemble cmd {} {}").type).to.eql(ValueType.COMMAND);
      });
      specify("the metacommand should return itself", () => {
        const value = evaluate("set cmd [ensemble {} {}]");
        expect(evaluate("$cmd")).to.eql(value);
      });

      mochadoc.section("Subcommands", () => {
        describe("`subcommands`", () => {
          it("should return list of subcommands", () => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
            expect(evaluate("[ensemble {} {}] subcommands")).to.eql(
              evaluate("list (subcommands eval call argspec)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("[ensemble {} {}] subcommands a")).to.eql(
                ERROR('wrong # args: should be "<ensemble> subcommands"')
              );
            });
          });
        });

        describe("`eval`", () => {
          it("should evaluate body in ensemble scope", () => {
            evaluate("ensemble cmd {} {let cst val}");
            expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
          });
          it("should accept tuple bodies", () => {
            evaluate("ensemble cmd {} {let cst val}");
            expect(evaluate("[cmd] eval (get cst)")).to.eql(STR("val"));
          });
          it("should evaluate macros in ensemble scope", () => {
            evaluate("ensemble cmd {} {macro mac {} {let cst val}}");
            evaluate("[cmd] eval {mac}");
            expect(rootScope.context.constants.has("cst")).to.be.false;
            expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
          });
          it("should evaluate closures in their scope", () => {
            evaluate("closure cls {} {let cst val}");
            evaluate("ensemble cmd {} {}");
            evaluate("[cmd] eval {cls}");
            expect(rootScope.context.constants.get("cst")).to.eql(STR("val"));
            expect(execute("[cmd] eval {get cst}").code).to.eql(
              ResultCode.ERROR
            );
          });

          describe("Control flow", () => {
            describe("`return`", () => {
              it("should interrupt the body with `RETURN` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {}");
                expect(execute("[cmd] eval {cmd1; return val3; cmd2}")).to.eql(
                  RETURN(STR("val3"))
                );
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`tailcall`", () => {
              it("should interrupt the body with `RETURN` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {}");
                expect(
                  execute("[cmd] eval {cmd1; tailcall {idem val3}; cmd2}")
                ).to.eql(RETURN(STR("val3")));
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`yield`", () => {
              it("should interrupt the body with `YIELD` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {}");
                expect(execute("[cmd] eval {cmd1; yield; cmd2}").code).to.eql(
                  ResultCode.YIELD
                );
                expect(evaluate("get var")).to.eql(STR("val1"));
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
                evaluate("ensemble cmd {} {}");
                expect(execute("[cmd] eval {cmd1; error msg; cmd2}")).to.eql(
                  ERROR("msg")
                );
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`break`", () => {
              it("should interrupt the body with `BREAK` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {}");
                expect(execute("[cmd] eval {cmd1; break; cmd2}")).to.eql(
                  BREAK()
                );
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`continue`", () => {
              it("should interrupt the body with `CONTINUE` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {}");
                expect(execute("[cmd] eval {cmd1; continue; cmd2}")).to.eql(
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

        describe("`call`", () => {
          it("should call ensemble commands", () => {
            evaluate("ensemble cmd {} {macro mac {} {idem val}}");
            expect(evaluate("[cmd] call mac")).to.eql(STR("val"));
          });
          it("should evaluate macros in the caller scope", () => {
            evaluate("ensemble cmd {} {macro mac {} {let cst val}}");
            evaluate("[cmd] call mac");
            expect(rootScope.context.constants.get("cst")).to.eql(STR("val"));
            evaluate("scope scp {[cmd] call mac}");
            expect(evaluate("[scp] eval {get cst}")).to.eql(STR("val"));
          });
          it("should evaluate ensemble closures in ensemble scope", () => {
            evaluate("ensemble cmd {} {closure cls {} {let cst val}}");
            evaluate("[cmd] call cls");
            expect(rootScope.context.constants.has("cst")).to.be.false;
            expect(evaluate("[cmd] eval {get cst}")).to.eql(STR("val"));
          });

          describe("Control flow", () => {
            describe("`return`", () => {
              it("should interrupt the body with `RETURN` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate(
                  "ensemble cmd {} {macro mac {} {cmd1; return val3; cmd2}}"
                );
                expect(execute("[cmd] call mac")).to.eql(RETURN(STR("val3")));
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`tailcall`", () => {
              it("should interrupt the body with `RETURN` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate(
                  "ensemble cmd {} {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
                );
                expect(execute("[cmd] call mac")).to.eql(RETURN(STR("val3")));
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`yield`", () => {
              it("should interrupt the call with `YIELD` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {macro mac {} {cmd1; yield; cmd2}}");
                expect(execute("[cmd] call mac").code).to.eql(ResultCode.YIELD);
                expect(evaluate("get var")).to.eql(STR("val1"));
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
                evaluate(
                  "ensemble cmd {} {macro mac {} {cmd1; error msg; cmd2}}"
                );
                expect(execute("[cmd] call mac")).to.eql(ERROR("msg"));
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`break`", () => {
              it("should interrupt the body with `BREAK` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate("ensemble cmd {} {macro mac {} {cmd1; break; cmd2}}");
                expect(execute("[cmd] call mac")).to.eql(BREAK());
                expect(evaluate("get var")).to.eql(STR("val1"));
              });
            });
            describe("`continue`", () => {
              it("should interrupt the body with `CONTINUE` code", () => {
                evaluate("closure cmd1 {} {set var val1}");
                evaluate("closure cmd2 {} {set var val2}");
                evaluate(
                  "ensemble cmd {} {macro mac {} {cmd1; continue; cmd2}}"
                );
                expect(execute("[cmd] call mac")).to.eql(CONTINUE());
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
              expect(execute("[ensemble {} {}] call")).to.eql(
                ERROR(
                  'wrong # args: should be "<ensemble> call cmdname ?arg ...?"'
                )
              );
            });
            specify("unknown command", () => {
              expect(execute("[ensemble {} {}] call unknownCommand")).to.eql(
                ERROR('unknown command "unknownCommand"')
              );
            });
            specify("out-of-scope command", () => {
              expect(
                execute("macro cmd {} {}; [ensemble {} {}] call cmd")
              ).to.eql(ERROR('unknown command "cmd"'));
            });
            specify("invalid command name", () => {
              expect(execute("[ensemble {} {}] call []")).to.eql(
                ERROR("invalid command name")
              );
            });
          });
        });

        describe("`argspec`", () => {
          example("should return the ensemble's argspec", [
            {
              doc: () => {
                /**
                 * Each ensemble has an argspec command associated to it,
                 * created with the ensemble's `argspec` argument. This
                 * subcommand will return it:
                 */
              },
              script: `
                [ensemble {a b} {}] argspec
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
              expect(execute("[ensemble {} {}] argspec a")).to.eql(
                ERROR('wrong # args: should be "<ensemble> argspec"')
              );
            });
          });
        });

        describe("Exceptions", () => {
          specify("unknown subcommand", () => {
            expect(execute("[ensemble {} {}] unknownSubcommand")).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("invalid subcommand name", () => {
            expect(execute("[ensemble {} {}] []")).to.eql(
              ERROR("invalid subcommand name")
            );
          });
        });
      });
    });
  });

  mochadoc.section("Ensemble commands", () => {
    mochadoc.description(() => {
      /**
       * Ensemble commands are commands that gather subcommands defined in their
       * own child scope.
       */
    });

    mochadoc.section("Specifications", () => {
      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[cmd]`.
         */
        const value = evaluate("ensemble cmd {} {}");
        expect(evaluate("cmd")).to.eql(value);
      });
      it("should return the provided arguments tuple when called with no subcommand", () => {
        /**
         * This property is useful for encapsulation.
         */
        evaluate("ensemble cmd {a b} {macro opt {a b} {idem val}}");
        expect(evaluate("cmd foo bar")).to.eql(TUPLE([STR("foo"), STR("bar")]));
      });
      it("should evaluate argument guards", () => {
        /**
         * This property is useful for validation.
         */
        evaluate("ensemble cmd {(int a) (list b)} {}");
        expect(evaluate("cmd 1 (foo bar)")).to.eql(
          TUPLE([INT(1), LIST([STR("foo"), STR("bar")])])
        );
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given an
         * insufficient number of arguments.
         */
        evaluate("ensemble cmd {a b} {}");
        expect(execute("cmd a")).to.eql(
          ERROR('wrong # args: should be "cmd a b ?subcommand? ?arg ...?"')
        );
      });
      specify("failed guards", () => {
        /**
         * The command will return an error message when an argument guard
         * fails.
         */
        evaluate("ensemble cmd {(int a) (list b)} {}");
        expect(execute("cmd a ()")).to.eql(ERROR('invalid integer "a"'));
        expect(execute("cmd 1 a")).to.eql(ERROR("invalid list"));
      });
    });

    mochadoc.section("Ensemble subcommands", () => {
      mochadoc.description(() => {
        /**
         * Commands defined in the ensemble scope will be exposed as
         * subcommands.
         */
      });

      specify(
        "first argument after ensemble arguments should be ensemble subcommand name",
        () => {
          evaluate("ensemble cmd {a b} {macro opt {a b} {idem val}}");
          expect(evaluate("cmd foo bar opt")).to.eql(STR("val"));
        }
      );
      it("should pass ensemble arguments to ensemble subcommand", () => {
        evaluate("ensemble cmd {a b} {macro opt {a b} {idem $a$b}}");
        expect(evaluate("cmd foo bar opt")).to.eql(STR("foobar"));
      });
      it("should apply guards to passed ensemble arguments", () => {
        evaluate(
          "ensemble cmd {(int a) (list b)} {macro opt {a b} {idem ($a $b)}}"
        );
        expect(evaluate("cmd 1 (foo bar) opt")).to.eql(
          TUPLE([INT(1), LIST([STR("foo"), STR("bar")])])
        );
      });
      it("should pass remaining arguments to ensemble subcommand", () => {
        evaluate("ensemble cmd {a b} {macro opt {a b c d} {idem $a$b$c$d}}");
        expect(evaluate("cmd foo bar opt baz sprong")).to.eql(
          STR("foobarbazsprong")
        );
      });
      it("should evaluate subcommand in the caller scope", () => {
        evaluate("ensemble cmd {} {macro mac {} {let cst val}}");
        evaluate("cmd mac");
        expect(rootScope.context.constants.get("cst")).to.eql(STR("val"));
        evaluate("scope scp {cmd mac}");
        expect(evaluate("[scp] eval {get cst}")).to.eql(STR("val"));
      });
      it("should work recursively", () => {
        evaluate(
          "ensemble en1 {a b} {ensemble en2 {a b c d} {macro opt {a b c d e f} {idem $a$b$c$d$e$f}}}"
        );
        expect(evaluate("en1 foo bar en2 baz sprong opt val1 val2")).to.eql(
          STR("foobarbazsprongval1val2")
        );
      });

      mochadoc.section("Introspection", () => {
        describe("`subcommands`", () => {
          mochadoc.description(() => {
            /**
             * `subcommands` is a predefined subcommand that is available for
             * all ensemble commands.
             */
          });
          beforeEach(() => {
            evaluate("ensemble cmd1 {} {}");
            evaluate("ensemble cmd2 {a b} {}");
          });
          it("should return list of subcommands", () => {
            expect(evaluate("cmd1 subcommands")).to.eql(
              evaluate("list (subcommands)")
            );
            evaluate("[cmd1] eval {macro mac1 {} {}}");
            expect(evaluate("cmd1 subcommands")).to.eql(
              evaluate("list (subcommands mac1)")
            );

            expect(evaluate("cmd2 a b subcommands")).to.eql(
              evaluate("list (subcommands)")
            );
            evaluate("[cmd2] eval {macro mac2 {} {}}");
            expect(evaluate("cmd2 a b subcommands")).to.eql(
              evaluate("list (subcommands mac2)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("cmd1 subcommands a")).to.eql(
                ERROR('wrong # args: should be "cmd1 subcommands"')
              );
              expect(execute("help cmd1 subcommands a")).to.eql(
                ERROR('wrong # args: should be "cmd1 subcommands"')
              );
              expect(execute("cmd2 a b subcommands c")).to.eql(
                ERROR('wrong # args: should be "cmd2 a b subcommands"')
              );
              expect(execute("help cmd2 a b subcommands c")).to.eql(
                ERROR('wrong # args: should be "cmd2 a b subcommands"')
              );
            });
          });
        });
      });

      mochadoc.section("Help", () => {
        mochadoc.description(() => {
          /**
           * Ensemble commands have built-in support for `help` on all
           * subcommands that support it.
           */
        });

        it("should provide subcommand help", () => {
          evaluate(`
            ensemble cmd {a} {
              macro opt1 {a b} {}
              closure opt2 {c d} {}
            }
          `);
          expect(evaluate("help cmd")).to.eql(
            STR("cmd a ?subcommand? ?arg ...?")
          );
          expect(evaluate("help cmd 1")).to.eql(
            STR("cmd a ?subcommand? ?arg ...?")
          );
          expect(evaluate("help cmd 1 subcommands")).to.eql(
            STR("cmd a subcommands")
          );
          expect(evaluate("help cmd 1 opt1")).to.eql(STR("cmd a opt1 b"));
          expect(evaluate("help cmd 2 opt1 3")).to.eql(STR("cmd a opt1 b"));
          expect(evaluate("help cmd 4 opt2")).to.eql(STR("cmd a opt2 d"));
          expect(evaluate("help cmd 5 opt2 6")).to.eql(STR("cmd a opt2 d"));
        });
        it("should work recursively", () => {
          evaluate(`
            ensemble cmd {a} {
              ensemble sub {a b} {
                macro opt {a b c} {}
              }
            }
          `);
          expect(evaluate("help cmd 1 sub")).to.eql(
            STR("cmd a sub b ?subcommand? ?arg ...?")
          );
          expect(evaluate("help cmd 1 sub 2")).to.eql(
            STR("cmd a sub b ?subcommand? ?arg ...?")
          );
          expect(evaluate("help cmd 1 sub 2 subcommands")).to.eql(
            STR("cmd a sub b subcommands")
          );
          expect(evaluate("help cmd 1 sub 2 opt")).to.eql(
            STR("cmd a sub b opt c")
          );
          expect(evaluate("help cmd 1 sub 2 opt 3")).to.eql(
            STR("cmd a sub b opt c")
          );
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The command will return an error message with usage when given
             * the wrong number of arguments.
             */
            evaluate(`
              ensemble cmd {a} {
                macro opt {a b} {}
                ensemble sub {a b} {
                  macro opt {a b c} {}
                }
              }
            `);
            expect(execute("help cmd 1 subcommands 2")).to.eql(
              ERROR('wrong # args: should be "cmd a subcommands"')
            );
            expect(execute("help cmd 1 opt 2 3")).to.eql(
              ERROR('wrong # args: should be "cmd a opt b"')
            );
            expect(execute("help cmd 1 sub 2 subcommands 3")).to.eql(
              ERROR('wrong # args: should be "cmd a sub b subcommands"')
            );
            expect(execute("help cmd 1 sub 2 opt 3 4")).to.eql(
              ERROR('wrong # args: should be "cmd a sub b opt c"')
            );
          });
          specify("invalid `subcommand`", () => {
            /**
             * Only named commands are supported, hence the `subcommand`
             * argument must have a valid string representation.
             */
            evaluate("ensemble cmd {a} {}");
            expect(execute("help cmd 1 []")).to.eql(
              ERROR("invalid subcommand name")
            );
          });
          specify("unknown subcommand", () => {
            /**
             * The command cannot get help for a non-existing subcommand.
             */
            evaluate("ensemble cmd {a} {}");
            expect(execute("help cmd 1 unknownSubcommand")).to.eql(
              ERROR('unknown subcommand "unknownSubcommand"')
            );
          });
          specify("subcommand with no help", () => {
            /**
             * The command cannot get help for a subcommand that has none.
             */
            rootScope.registerNamedCommand("foo", {
              execute() {
                return OK(NIL);
              },
            });
            evaluate("ensemble cmd {a} {alias opt foo}");
            expect(execute("help cmd 1 opt")).to.eql(
              ERROR('no help for subcommand "opt"')
            );
          });
        });
      });

      mochadoc.section("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If a subcommand returns a result code other than `OK` then it
           * should be propagated properly to the caller.
           */
        });

        describe("`return`", () => {
          it("should interrupt the call with `RETURN` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate(
              "ensemble cmd {} {macro mac {} {cmd1; return val3; cmd2}}"
            );
            expect(execute("cmd mac")).to.eql(RETURN(STR("val3")));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt the call with `RETURN` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate(
              "ensemble cmd {} {macro mac {} {cmd1; tailcall {idem val3}; cmd2}}"
            );
            expect(execute("cmd mac")).to.eql(RETURN(STR("val3")));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("`yield`", () => {
          it("should interrupt the call with `YIELD` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; yield; cmd2}}");
            expect(execute("cmd mac").code).to.eql(ResultCode.YIELD);
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
          it("should provide a resumable state", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {val} {set var $val}");
            evaluate("ensemble cmd {} {proc p {} {cmd1; cmd2 _[yield val2]_}}");
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
        describe("`error`", () => {
          it("should interrupt the call with `ERROR` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; error msg; cmd2}}");
            expect(execute("cmd mac")).to.eql(ERROR("msg"));
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("`break`", () => {
          it("should interrupt the call with `BREAK` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; break; cmd2}}");
            expect(execute("cmd mac")).to.eql(BREAK());
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
        describe("`continue`", () => {
          it("should interrupt the call with `CONTINUE` code", () => {
            evaluate("closure cmd1 {} {set var val1}");
            evaluate("closure cmd2 {} {set var val2}");
            evaluate("ensemble cmd {} {macro mac {} {cmd1; continue; cmd2}}");
            expect(execute("cmd mac")).to.eql(CONTINUE());
            expect(evaluate("get var")).to.eql(STR("val1"));
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          evaluate("ensemble cmd {} {}");
          expect(execute("cmd unknownCommand")).to.eql(
            ERROR('unknown subcommand "unknownCommand"')
          );
        });
        specify("out-of-scope subcommand", () => {
          /**
           * Commands inherited from their parent scope are not available as
           * ensemble subcommands.
           */
          evaluate("macro mac {} {}; ensemble cmd {} {}");
          expect(execute("cmd mac")).to.eql(ERROR('unknown subcommand "mac"'));
        });
        specify("invalid subcommand name", () => {
          evaluate("ensemble cmd {} {}");
          expect(execute("cmd []")).to.eql(ERROR("invalid subcommand name"));
        });
      });
    });
  });
});
