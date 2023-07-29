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
import { FALSE, TRUE, NIL, STR } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock } from "./test-helpers";

describe("Helena logic operations", () => {
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

  beforeEach(init);

  describe("Booleans", () => {
    mochadoc.usage(usage("true") + "\n" + usage("false"));
    mochadoc.description(() => {
      /**
       * Boolean values (or booleans) are Helena values whose internal type is
       * `BOOLEAN`.
       */
    });

    it("are valid commands", () => {
      /**
       * Boolean `true` and `false` are regular commands.
       */
      expect(evaluate("true")).to.eql(TRUE);
      expect(evaluate("false")).to.eql(FALSE);
    });
    it("are idempotent", () => {
      /**
       * Argument-less boolean commands return themselves.
       */
      expect(evaluate("[true]")).to.eql(TRUE);
      expect(evaluate("[false]")).to.eql(FALSE);
    });

    mochadoc.section("Infix operators", () => {
      mochadoc.description(() => {
        /**
         * A boolean followed by an operator can be used for expressions in
         * infix notation.
         */
      });

      mochadoc.section("Conditional", () => {
        describe("`?`", () => {
          mochadoc.summary("Conditional operator");
          mochadoc.description(usage("true ?") + "\n" + usage("false ?"));
          mochadoc.description(() => {
            /**
             * The `?` operator conditionally returns a truthy vs. falsy value.
             */
          });

          describe("`true`", () => {
            it("should return first argument", () => {
              expect(evaluate("true ? a b")).to.eql(STR("a"));
            });
            it("should support a single argument", () => {
              expect(evaluate("true ? a")).to.eql(STR("a"));
            });
          });
          describe("`false`", () => {
            it("should return nil if no second argument is given", () => {
              expect(evaluate("false ? a")).to.eql(NIL);
            });
            it("should return second argument", () => {
              expect(evaluate("false ? a b")).to.eql(STR("b"));
            });
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("true ?")).to.eql(
                ERROR('wrong # args: should be "true ? arg ?arg?"')
              );
              expect(execute("true ? a b c")).to.eql(
                ERROR('wrong # args: should be "true ? arg ?arg?"')
              );
              expect(execute("help true ? a b c")).to.eql(
                ERROR('wrong # args: should be "true ? arg ?arg?"')
              );
              expect(execute("false ?")).to.eql(
                ERROR('wrong # args: should be "false ? arg ?arg?"')
              );
              expect(execute("false ? a b c")).to.eql(
                ERROR('wrong # args: should be "false ? arg ?arg?"')
              );
              expect(execute("help false ? a b c")).to.eql(
                ERROR('wrong # args: should be "false ? arg ?arg?"')
              );
            });
          });
        });

        describe("`!?`", () => {
          mochadoc.summary("Reverse conditional operator");
          mochadoc.description(usage("true !?") + "\n" + usage("false !?"));
          mochadoc.description(() => {
            /**
             * The `!?` operator conditionally returns a falsy vs. truthy value.
             * It is the opposite of `?`.
             */
          });

          describe("`true`", () => {
            it("should return nil if no second argument is given", () => {
              expect(evaluate("true !? a")).to.eql(NIL);
            });
            it("should return second argument", () => {
              expect(evaluate("true !? a b")).to.eql(STR("b"));
            });
          });
          describe("`false`", () => {
            it("should return first argument", () => {
              expect(evaluate("false !? a b")).to.eql(STR("a"));
            });
            it("should support a single argument", () => {
              expect(evaluate("false !? a")).to.eql(STR("a"));
            });
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("true !?")).to.eql(
                ERROR('wrong # args: should be "true !? arg ?arg?"')
              );
              expect(execute("true !? a b c")).to.eql(
                ERROR('wrong # args: should be "true !? arg ?arg?"')
              );
              expect(execute("help true !? a b c")).to.eql(
                ERROR('wrong # args: should be "true !? arg ?arg?"')
              );
              expect(execute("false !?")).to.eql(
                ERROR('wrong # args: should be "false !? arg ?arg?"')
              );
              expect(execute("false !? a b c")).to.eql(
                ERROR('wrong # args: should be "false !? arg ?arg?"')
              );
              expect(execute("help false !? a b c")).to.eql(
                ERROR('wrong # args: should be "false !? arg ?arg?"')
              );
            });
          });
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * Apart from operators, boolean commands accept the subcommands listed
         * here.
         */
      });

      mochadoc.section("Introspection", () => {
        describe("`subcommands`", () => {
          mochadoc.description(
            usage("true subcommands") + "\n" + usage("false subcommands")
          );
          mochadoc.description(() => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
          });
          it("should return list of subcommands", () => {
            expect(evaluate("true subcommands")).to.eql(
              evaluate("list (subcommands ? !?)")
            );
            expect(evaluate("false subcommands")).to.eql(
              evaluate("list (subcommands ? !?)")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("true subcommands a")).to.eql(
                ERROR('wrong # args: should be "true subcommands"')
              );
              expect(execute("help true subcommands a")).to.eql(
                ERROR('wrong # args: should be "true subcommands"')
              );
              expect(execute("false subcommands a")).to.eql(
                ERROR('wrong # args: should be "false subcommands"')
              );
              expect(execute("help false subcommands a")).to.eql(
                ERROR('wrong # args: should be "false subcommands"')
              );
            });
          });
        });
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("unknown subcommand", () => {
        expect(execute("true unknownSubcommand")).to.eql(
          ERROR('unknown subcommand "unknownSubcommand"')
        );
        expect(execute("false unknownSubcommand")).to.eql(
          ERROR('unknown subcommand "unknownSubcommand"')
        );
      });
      specify("invalid subcommand name", () => {
        expect(execute("true []")).to.eql(ERROR("invalid subcommand name"));
        expect(execute("false []")).to.eql(ERROR("invalid subcommand name"));
      });
    });
  });

  mochadoc.section("Prefix operators", () => {
    describe("`!`", () => {
      mochadoc.summary("Logical NOT operator");
      mochadoc.description(usage("!"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          expect(evaluate("help !")).to.eql(STR("! arg"));
        });
        it("should invert boolean values", () => {
          expect(evaluate("! true")).to.eql(FALSE);
          expect(evaluate("! false")).to.eql(TRUE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("! {idem true}")).to.eql(FALSE);
          expect(evaluate("! {idem false}")).to.eql(TRUE);
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
          expect(execute("!")).to.eql(ERROR('wrong # args: should be "! arg"'));
          expect(execute("! a b")).to.eql(
            ERROR('wrong # args: should be "! arg"')
          );
          expect(execute("help ! a b")).to.eql(
            ERROR('wrong # args: should be "! arg"')
          );
        });
        specify("invalid value", () => {
          /**
           * Only booleans and scripts are acceptable values.
           */
          expect(execute("! 1")).to.eql(ERROR('invalid boolean "1"'));
          expect(execute("! 1.23")).to.eql(ERROR('invalid boolean "1.23"'));
          expect(execute("! a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });

      mochadoc.section("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("! {return value; unreachable}")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("! {tailcall {idem value}; unreachable}")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`yield`", () => {
          it("should interrupt expression with `YIELD` code", () => {
            const result = execute("! {yield value; true}");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("value"));
          });
          it("should provide a resumable state", () => {
            const process = rootScope.prepareScript(
              parse("! {yield val1; yield val2}")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(TRUE);
            result = process.run();
            expect(result).to.eql(OK(FALSE));
          });
        });
        describe("`error`", () => {
          it("should interrupt expression with `ERROR` code", () => {
            expect(execute("! {error msg; false}")).to.eql(ERROR("msg"));
          });
        });
        describe("`break`", () => {
          it("should interrupt expression with `BREAK` code", () => {
            expect(execute("! {break; unreachable}")).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt expression with `CONTINUE` code", () => {
            expect(execute("! {continue; false}")).to.eql(CONTINUE());
          });
        });
      });
    });

    describe("`&&`", () => {
      mochadoc.summary("Logical AND operator");
      mochadoc.description(usage("&&"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          expect(evaluate("help &&")).to.eql(STR("&& arg ?arg ...?"));
        });
        it("should accept one boolean", () => {
          expect(evaluate("&& false")).to.eql(FALSE);
          expect(evaluate("&& true")).to.eql(TRUE);
        });
        it("should accept two booleans", () => {
          expect(evaluate("&& false false")).to.eql(FALSE);
          expect(evaluate("&& false true")).to.eql(FALSE);
          expect(evaluate("&& true false")).to.eql(FALSE);
          expect(evaluate("&& true true")).to.eql(TRUE);
        });
        it("should accept several booleans", () => {
          expect(evaluate("&&" + " true".repeat(3))).to.eql(TRUE);
          expect(evaluate("&&" + " true".repeat(3) + " false")).to.eql(FALSE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("&& {idem false}")).to.eql(FALSE);
          expect(evaluate("&& {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on `false`", () => {
          expect(evaluate("&& false {unreachable}")).to.eql(FALSE);
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
          expect(execute("&&")).to.eql(
            ERROR('wrong # args: should be "&& arg ?arg ...?"')
          );
        });
        specify("invalid value", () => {
          /**
           * Only booleans and scripts are acceptable values.
           */
          expect(execute("&& a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });

      mochadoc.section("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If a script expression returns a result code othen than `OK` then
           * it should be propagated properly to the caller.
           */
        });

        describe("`return`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("&& true {return value; unreachable} false")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(
              execute("&& true {tailcall {idem value}; unreachable} false")
            ).to.eql(RETURN(STR("value")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt expression with `YIELD` code", () => {
            const result = execute("&& true {yield value; true}");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("value"));
          });
          it("should provide a resumable state", () => {
            const process = rootScope.prepareScript(
              parse("&& {yield val1} {yield val2} ")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            process.yieldBack(TRUE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(FALSE);
            result = process.run();
            expect(result).to.eql(OK(FALSE));
          });
        });
        describe("`error`", () => {
          it("should interrupt expression with `ERROR` code", () => {
            expect(execute("&& true {error msg; true} false")).to.eql(
              ERROR("msg")
            );
          });
        });
        describe("`break`", () => {
          it("should interrupt expression with `BREAK` code", () => {
            expect(execute("&& true {break; unreachable} false")).to.eql(
              BREAK()
            );
          });
        });
        describe("`continue`", () => {
          it("should interrupt expression with `CONTINUE` code", () => {
            expect(execute("&& true {continue; unreachable} false")).to.eql(
              CONTINUE()
            );
          });
        });
      });
    });

    describe("`||`", () => {
      mochadoc.summary("Logical OR operator");
      mochadoc.usage(usage("||"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          expect(evaluate("help ||")).to.eql(STR("|| arg ?arg ...?"));
        });
        it("should accept one boolean", () => {
          expect(evaluate("|| false")).to.eql(FALSE);
          expect(evaluate("|| true")).to.eql(TRUE);
        });
        it("should accept two booleans", () => {
          expect(evaluate("|| false false")).to.eql(FALSE);
          expect(evaluate("|| false true")).to.eql(TRUE);
          expect(evaluate("|| true false")).to.eql(TRUE);
          expect(evaluate("|| true true")).to.eql(TRUE);
        });
        it("should accept several booleans", () => {
          expect(evaluate("||" + " false".repeat(3))).to.eql(FALSE);
          expect(evaluate("||" + " false".repeat(3) + " true")).to.eql(TRUE);
        });
        it("should accept script expressions", () => {
          expect(evaluate("|| {idem false}")).to.eql(FALSE);
          expect(evaluate("|| {idem true}")).to.eql(TRUE);
        });
        it("should short-circuit on `true`", () => {
          expect(evaluate("|| true {unreachable}")).to.eql(TRUE);
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * Operators will return an error message with usage when given the
           * wrong number of arguments.
           */
          expect(execute("||")).to.eql(
            ERROR('wrong # args: should be "|| arg ?arg ...?"')
          );
        });
        specify("invalid value", () => {
          /**
           * Only booleans and scripts are acceptable values.
           */
          expect(execute("|| a")).to.eql(ERROR('invalid boolean "a"'));
        });
      });

      mochadoc.section("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If a script expression returns a result code othen than `OK` then
           * it should be propagated properly to the caller.
           */
        });

        describe("`return`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(execute("|| false {return value; unreachable} true")).to.eql(
              RETURN(STR("value"))
            );
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt expression with `RETURN` code", () => {
            expect(
              execute("|| false {tailcall {idem value}; unreachable} true")
            ).to.eql(RETURN(STR("value")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt expression with `YIELD` code", () => {
            const result = execute("|| false {yield value; false}");
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("value"));
          });
          it("should provide a resumable state", () => {
            const process = rootScope.prepareScript(
              parse("|| {yield val1} {yield val2} ")
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val1"));
            expect(result.data).to.exist;

            process.yieldBack(FALSE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("val2"));
            expect(result.data).to.exist;

            process.yieldBack(TRUE);
            result = process.run();
            expect(result).to.eql(OK(TRUE));
          });
        });
        describe("`error`", () => {
          it("should interrupt expression with `ERROR` code", () => {
            expect(execute("|| false {error msg; true} true")).to.eql(
              ERROR("msg")
            );
          });
        });
        describe("`break`", () => {
          it("should interrupt expression with `BREAK` code", () => {
            expect(execute("|| false {break; unreachable} true")).to.eql(
              BREAK()
            );
          });
        });
        describe("`continue`", () => {
          it("should interrupt expression with `CONTINUE` code", () => {
            expect(execute("|| false {continue; unreachable} true")).to.eql(
              CONTINUE()
            );
          });
        });
      });
    });
  });
});
