import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import {
  BREAK,
  CONTINUE,
  ERROR,
  OK,
  RESULT_CODE_NAME,
  ResultCode,
  RETURN,
  YIELD,
} from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, NIL, STR, StringValue, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena control flow commands", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
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

  describeCommand("while", () => {
    mochadoc.summary("Conditional loop");
    mochadoc.usage(usage("while"));
    mochadoc.description(() => {
      /**
       * The `while` command loops over a body script while a test condition is
       * true.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help while")).to.eql(STR("while test body"));
        expect(evaluate("help while val")).to.eql(STR("while test body"));
      });

      it("should skip `body` when `test` is false", () => {
        expect(execute("while false {unreachable}").code).to.eql(ResultCode.OK);
      });
      it("should loop over `body` while `test` is true", () => {
        evaluate("set i 0; while {$i < 10} {set i [+ $i 1]}");
        expect(evaluate("get i")).to.eql(INT(10));
      });
      it("should return the result of the last command", () => {
        expect(execute(" while false {}")).to.eql(OK(NIL));
        expect(
          evaluate("set i 0; while {$i < 10} {set i [+ $i 1]; idem val$i}")
        ).to.eql(STR("val10"));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("while a")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
        expect(execute("while a b c")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
        expect(execute("help while a b c")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("while a b")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("Control flow", () => {
      mochadoc.description(() => {
        /**
         * If the test returns a result code other than `OK` then it should be
         * propagated properly by the command.
         *
         * The normal return code of the body is `OK`. `BREAK` and `CONTINUE`
         * codes are handled by the command and the others are propagated to the
         * caller.
         */
      });

      describe("`return`", () => {
        it("should interrupt the test with `RETURN` code", () => {
          expect(
            execute("while {return val; unreachable} {unreachable}")
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt the loop with `RETURN` code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; return val; unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
          expect(evaluate("get i")).to.eql(INT(1));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt the test with `RETURN` code", () => {
          expect(
            execute("while {tailcall {idem val}; unreachable} {unreachable}")
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt the loop with `RETURN` code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; tailcall {idem val}; unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
          expect(evaluate("get i")).to.eql(INT(1));
        });
      });
      describe("`yield`", () => {
        it("should interrupt the test with `YIELD` code", () => {
          expect(execute("while {yield; unreachable} {}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should interrupt the body with `YIELD` code", () => {
          expect(execute("while {true} {yield; unreachable}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should provide a resumable state", () => {
          const process = prepareScript("while {yield test} {yield body}");

          let result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("test"));

          process.yieldBack(TRUE);
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("body"));

          process.yieldBack(STR("step 1"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("test"));

          process.yieldBack(TRUE);
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("body"));

          process.yieldBack(STR("step 2"));
          result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("test"));

          process.yieldBack(FALSE);
          result = process.run();
          expect(result).to.eql(OK(STR("step 2")));
        });
      });
      describe("`error`", () => {
        it("should interrupt the test with `ERROR` code", () => {
          expect(
            execute("while {error msg; set var val} {unreachable}")
          ).to.eql(ERROR("msg"));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
        it("should interrupt the loop with `ERROR` code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; error msg; set var val}"
            )
          ).to.eql(ERROR("msg"));
          expect(evaluate("get i")).to.eql(INT(1));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
      });
      describe("`break`", () => {
        it("should interrupt the test with `BREAK` code", () => {
          expect(execute("while {break; unreachable} {unreachable}")).to.eql(
            BREAK()
          );
        });
        it("should interrupt the body with `nil` result", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; break; unreachable}"
            )
          ).to.eql(OK(NIL));
          expect(evaluate("get i")).to.eql(INT(1));
        });
      });
      describe("`continue`", () => {
        it("should interrupt the test with `CONTINUE` code", () => {
          expect(execute("while {continue; unreachable} {unreachable}")).to.eql(
            CONTINUE()
          );
        });
        it("should interrupt the body iteration", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; continue; unreachable}"
            )
          ).to.eql(OK(NIL));
          expect(evaluate("get i")).to.eql(INT(10));
        });
      });
    });
  });

  describeCommand("if", () => {
    mochadoc.summary("Conditional branching");
    mochadoc.usage(usage("if"));
    mochadoc.description(() => {
      /**
       * The `if` command executes a branch conditionally depending on a test
       * condition.
       *
       * The syntax is similar to Tcl: test and body pairs are separated by
       * `elseif` and `else` keywords.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help if")).to.eql(
          STR("if test body ?elseif test body ...? ?else? ?body?")
        );
      });

      it("should return the result of the first true body", () => {
        expect(evaluate("if true {1}")).to.eql(INT(1));
        expect(evaluate("if true {1} else {2}")).to.eql(INT(1));
        expect(evaluate("if true {1} elseif true {2} else {3}")).to.eql(INT(1));
        expect(
          evaluate("if false {1} elseif true {2} elseif true {3} else {4}")
        ).to.eql(INT(2));
        expect(evaluate("if false {1} elseif true {2} else {3}")).to.eql(
          INT(2)
        );
        expect(
          evaluate("if false {1} elseif true {2} elseif true {3} else {4}")
        ).to.eql(INT(2));
      });
      it("should return the result of the `else` body when all tests are false", () => {
        expect(evaluate("if false {1} else {2}")).to.eql(INT(2));
        expect(evaluate("if false {1} elseif false {2} else {3}")).to.eql(
          INT(3)
        );
        expect(
          evaluate("if false {1} elseif false {2} elseif false {3} else {4}")
        ).to.eql(INT(4));
      });
      it("should skip leading false bodies", () => {
        expect(evaluate("if false {unreachable}")).to.eql(NIL);
        expect(
          evaluate("if false {unreachable} elseif false {unreachable}")
        ).to.eql(NIL);
        expect(
          evaluate(
            "if false {unreachable} elseif false {unreachable} elseif false {unreachable}"
          )
        ).to.eql(NIL);
      });
      it("should skip trailing tests and bodies", () => {
        expect(evaluate("if true {1} else {unreachable}")).to.eql(INT(1));
        expect(
          evaluate("if true {1} elseif {unreachable} {unreachable}")
        ).to.eql(INT(1));
        expect(
          evaluate(
            "if true {1} elseif {unreachable} {unreachable} else {unreachable}"
          )
        ).to.eql(INT(1));
        expect(
          evaluate(
            "if false {1} elseif true {2} elseif {unreachable} {unreachable}"
          )
        ).to.eql(INT(2));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("if")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
        expect(execute("if a")).to.eql(ERROR("wrong # args: missing if body"));
        expect(execute("if a b else")).to.eql(
          ERROR("wrong # args: missing else body")
        );
        expect(execute("if a b elseif")).to.eql(
          ERROR("wrong # args: missing elseif test")
        );
        expect(execute("if a b elseif c")).to.eql(
          ERROR("wrong # args: missing elseif body")
        );
        expect(execute("if a b elseif c d else")).to.eql(
          ERROR("wrong # args: missing else body")
        );
      });
      specify("invalid keyword", () => {
        /**
         * Only `else` and `elseif` keywords are accepted.
         */
        expect(execute("if a b elif c d")).to.eql(
          ERROR('invalid keyword "elif"')
        );
        expect(execute("if a b fi")).to.eql(ERROR('invalid keyword "fi"'));
        expect(execute("if a b []")).to.eql(ERROR("invalid keyword"));
      });
      specify("invalid test", () => {
        /**
         * Tests must be booleans or script expressions.
         */
        expect(execute("if a b")).to.eql(ERROR('invalid boolean "a"'));
        expect(execute("if false {a} elseif b {c}")).to.eql(
          ERROR('invalid boolean "b"')
        );
        expect(execute("if false a elseif false b elseif c d")).to.eql(
          ERROR('invalid boolean "c"')
        );
      });
      specify("non-script body", () => {
        expect(execute("if true a")).to.eql(ERROR("body must be a script"));
        expect(execute("if false {} else a ")).to.eql(
          ERROR("body must be a script")
        );
        expect(execute("if false {} elseif true a")).to.eql(
          ERROR("body must be a script")
        );
        expect(execute("if false {} elseif false {} else a")).to.eql(
          ERROR("body must be a script")
        );
      });
    });

    mochadoc.section("Control flow", () => {
      mochadoc.description(() => {
        /**
         * If a test or body returns a result code other than `OK` then it
         * should be propagated properly by the command.
         */
      });

      describe("`return`", () => {
        it("should interrupt tests with `RETURN` code", () => {
          expect(execute("if {return val; unreachable} {unreachable}")).to.eql(
            RETURN(STR("val"))
          );
          expect(
            execute(
              "if false {} elseif {return val; unreachable} {unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt bodies with `RETURN` code", () => {
          expect(execute("if true {return val; unreachable}")).to.eql(
            RETURN(STR("val"))
          );
          expect(
            execute("if false {} elseif true {return val; unreachable}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "if false {} elseif false {} else {return val; unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt tests with `RETURN` code", () => {
          expect(
            execute("if {tailcall {idem val}; unreachable} {unreachable}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "if false {} elseif {tailcall {idem val}; unreachable} {unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt bodies with `RETURN` code", () => {
          expect(execute("if true {tailcall {idem val}; unreachable}")).to.eql(
            RETURN(STR("val"))
          );
          expect(
            execute(
              "if false {} elseif true {tailcall {idem val}; unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "if false {} elseif false {} else {tailcall {idem val}; unreachable}"
            )
          ).to.eql(RETURN(STR("val")));
        });
      });
      describe("`yield`", () => {
        it("should interrupt tests with `YIELD` code", () => {
          expect(execute("if {yield; unreachable} {unreachable}").code).to.eql(
            ResultCode.YIELD
          );
          expect(
            execute("if false {} elseif {yield; unreachable} {unreachable}")
              .code
          ).to.eql(ResultCode.YIELD);
        });
        it("should interrupt bodies with `YIELD` code", () => {
          expect(execute("if true {yield; unreachable}").code).to.eql(
            ResultCode.YIELD
          );
          expect(
            execute("if false {} elseif true {yield; unreachable}").code
          ).to.eql(ResultCode.YIELD);
          expect(
            execute("if false {} elseif false {} else {yield; unreachable}")
              .code
          ).to.eql(ResultCode.YIELD);
        });
        describe("should provide a resumable state", () => {
          let process;
          beforeEach(() => {
            process = prepareScript(
              "if {yield test1} {yield body1} elseif {yield test2} {yield body2} else {yield body3}"
            );
          });
          specify("if", () => {
            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("test1"));

            process.yieldBack(TRUE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("body1"));

            process.yieldBack(STR("result"));
            result = process.run();
            expect(result).to.eql(OK(STR("result")));
          });
          specify("elseif", () => {
            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("test1"));

            process.yieldBack(FALSE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("test2"));

            process.yieldBack(TRUE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("body2"));

            process.yieldBack(STR("result"));
            result = process.run();
            expect(result).to.eql(OK(STR("result")));
          });
          specify("else", () => {
            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("test1"));

            process.yieldBack(FALSE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("test2"));

            process.yieldBack(FALSE);
            result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("body3"));

            process.yieldBack(STR("result"));
            result = process.run();
            expect(result).to.eql(OK(STR("result")));
          });
        });
      });
      describe("`error`", () => {
        it("should interrupt tests with `ERROR` code", () => {
          expect(execute("if {error msg; unreachable} {unreachable}")).to.eql(
            ERROR("msg")
          );
          expect(
            execute("if false {} elseif {error msg; unreachable} {unreachable}")
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt bodies with `ERROR` code", () => {
          expect(execute("if true {error msg; unreachable}")).to.eql(
            ERROR("msg")
          );
          expect(
            execute("if false {} elseif true {error msg; unreachable}")
          ).to.eql(ERROR("msg"));
          expect(
            execute("if false {} elseif false {} else {error msg; unreachable}")
          ).to.eql(ERROR("msg"));
        });
      });
      describe("`break`", () => {
        it("should interrupt tests with `BREAK` code", () => {
          expect(execute("if {break; unreachable} {unreachable}")).to.eql(
            BREAK()
          );
          expect(
            execute("if false {} elseif {break; unreachable} {unreachable}")
          ).to.eql(BREAK());
        });
        it("should interrupt bodies with `BREAK` code", () => {
          expect(execute("if true {break; unreachable}")).to.eql(BREAK());
          expect(
            execute("if false {} elseif true {break; unreachable}")
          ).to.eql(BREAK());
          expect(
            execute("if false {} elseif false {} else {break; unreachable}")
          ).to.eql(BREAK());
        });
      });
      describe("`continue`", () => {
        it("should interrupt tests with `CONTINUE` code", () => {
          expect(execute("if {continue; unreachable} {unreachable}")).to.eql(
            CONTINUE()
          );
          expect(
            execute("if false {} elseif {continue; unreachable} {unreachable}")
          ).to.eql(CONTINUE());
        });
        it("should interrupt bodies with `CONTINUE` code", () => {
          expect(execute("if true {continue; unreachable}")).to.eql(CONTINUE());
          expect(
            execute("if false {} elseif true {continue; unreachable}")
          ).to.eql(CONTINUE());
          expect(
            execute("if false {} elseif false {} else {continue; unreachable}")
          ).to.eql(CONTINUE());
        });
      });
    });
  });

  describeCommand("when", () => {
    mochadoc.summary("Multi-way branching");
    mochadoc.usage(usage("when"));
    mochadoc.description(() => {
      /**
       * The `when` command chooses a branch to execute depending on one or
       * several conditions.
       *
       * `when` is similar to `switch` found in other languages, but more
       * generic and powerful. It is specifically designed to minimize verbosity
       * in complex cases.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help when")).to.eql(
          STR("when ?command? {?test body ...? ?default?}")
        );
      });

      it("should return nil with empty test list", () => {
        expect(evaluate("when {}")).to.eql(NIL);
      });
      it("should accept tuple case list", () => {
        expect(evaluate("when ()")).to.eql(NIL);
      });
      it("should return the result of the first true body", () => {
        expect(evaluate("when {true {1}}")).to.eql(INT(1));
        expect(evaluate("when {true {1} {2}}")).to.eql(INT(1));
        expect(evaluate("when {true {1} true {2} {3}}")).to.eql(INT(1));
        expect(evaluate("when {false {1} true {2} true {3} {4}}")).to.eql(
          INT(2)
        );
        expect(evaluate("when {false {1} true {2} {3}}")).to.eql(INT(2));
        expect(evaluate("when {false {1} true {2} true {3}  {4}}")).to.eql(
          INT(2)
        );
      });
      it("should skip leading false bodies", () => {
        expect(evaluate("when {false {unreachable}}")).to.eql(NIL);
        expect(
          evaluate("when {false {unreachable} false {unreachable}}")
        ).to.eql(NIL);
        expect(
          evaluate(
            "when {false {unreachable} false {unreachable} false {unreachable}}"
          )
        ).to.eql(NIL);
      });
      it("should skip trailing tests and bodies", () => {
        expect(evaluate("when {true {1} {unreachable}}")).to.eql(INT(1));
        expect(evaluate("when {true {1} {unreachable} {unreachable}}")).to.eql(
          INT(1)
        );
        expect(
          evaluate("when {true {1} {unreachable} {unreachable} {unreachable}}")
        ).to.eql(INT(1));
        expect(
          evaluate("when {false {1} true {2} {unreachable} {unreachable}}")
        ).to.eql(INT(2));
      });
      describe("no command", () => {
        it("should evaluate tests as boolean conditions", () => {
          expect(evaluate("when {true {1}}")).to.eql(INT(1));
          expect(evaluate("when {{idem true} {1}}")).to.eql(INT(1));
        });
      });
      describe("literal command", () => {
        it("should apply to tests", () => {
          expect(evaluate("when ! {true {1}}")).to.eql(NIL);
          expect(evaluate("when ! {true {1} {2}}")).to.eql(INT(2));
          expect(evaluate("when ! {true {1} true {2} {3}}")).to.eql(INT(3));
        });
        it("should be called on each test", () => {
          evaluate("macro test {v} {set count [+ $count 1]; idem $v}");
          evaluate("set count 0");
          expect(evaluate("when test {false {1} false {2} {3}}")).to.eql(
            INT(3)
          );
          expect(evaluate("get count")).to.eql(INT(2));
        });
        it("should pass test literal as argument", () => {
          expect(evaluate("when ! {false {1} true {2} true {3} {4}}")).to.eql(
            evaluate("when {{! false} {1} {! true} {2} {! true} {3} {4}}")
          );
          expect(evaluate("when ! {true {1} false {2} {3}}")).to.eql(
            evaluate("when {{! true} {1} {! false} {2} {3}}")
          );
        });
        it("should pass test tuple values as arguments", () => {
          expect(evaluate("when 1 {(== 2) {1} (!= 1) {2} {3}}")).to.eql(
            evaluate("when {{1 == 2} {1} {1 != 1} {2} {3}}")
          );
          expect(evaluate("when true {(? false) {1} () {2} {3}}")).to.eql(
            evaluate("when true {(? false) {1} () {2} {3}}")
          );
        });
      });
      describe("tuple command", () => {
        it("should apply to tests", () => {
          expect(evaluate("when (1 ==) {2 {1} 1 {2} {3}}")).to.eql(INT(2));
        });
        it("should be called on each test", () => {
          evaluate("macro test {cmd v} {set count [+ $count 1]; $cmd $v}");
          evaluate("set count 0");
          expect(
            evaluate("when (test (true ?)) {false {1} false {2} {3}}")
          ).to.eql(INT(3));
          expect(evaluate("get count")).to.eql(INT(2));
        });
        it("should pass test literal as argument", () => {
          expect(evaluate("when (1 ==) {2 {1} 3 {2} 1 {3} {4}}")).to.eql(
            INT(3)
          );
        });
        it("should pass test tuple values as arguments", () => {
          expect(evaluate("when () {false {1} true {2} {3}}")).to.eql(INT(2));
          expect(evaluate("when (1) {(== 2) {1} (!= 1) {2} {3}}")).to.eql(
            INT(3)
          );
          expect(
            evaluate("when (&& true) {(true false) {1} (true) {2} {3}}")
          ).to.eql(INT(2));
        });
      });
      describe("script command", () => {
        it("evaluation result should apply to tests", () => {
          evaluate("macro test {v} {idem $v}");
          expect(evaluate("when {idem test} {false {1} true {2} {3}}")).to.eql(
            INT(2)
          );
        });
        it("should be called on each test", () => {
          evaluate("macro test {cmd} {set count [+ $count 1]; idem $cmd}");
          evaluate("set count 0");
          expect(evaluate("when {test !} {true {1} true {2} {3}}")).to.eql(
            INT(3)
          );
          expect(evaluate("get count")).to.eql(INT(2));
        });
        it("should pass test literal as argument", () => {
          evaluate("macro test {v} {1 == $v}");
          expect(evaluate("when {idem test} {2 {1} 3 {2} 1 {3} {4}}")).to.eql(
            INT(3)
          );
        });
        it("should pass test tuple values as arguments", () => {
          evaluate("macro test {v1 v2} {$v1 == $v2}");
          expect(evaluate("when {idem test} {(1 2) {1} (1 1) {2} {3}}")).to.eql(
            INT(2)
          );
          expect(evaluate("when {1} {(== 2) {1} (!= 1) {2} {3}}")).to.eql(
            INT(3)
          );
          expect(
            evaluate("when {idem (&& true)} {(true false) {1} (true) {2} {3}}")
          ).to.eql(INT(2));
        });
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("when")).to.eql(
          ERROR(
            'wrong # args: should be "when ?command? {?test body ...? ?default?}"'
          )
        );
        expect(execute("when a b c")).to.eql(
          ERROR(
            'wrong # args: should be "when ?command? {?test body ...? ?default?}"'
          )
        );
        expect(execute("help when a b c")).to.eql(
          ERROR(
            'wrong # args: should be "when ?command? {?test body ...? ?default?}"'
          )
        );
      });
      specify("invalid case list", () => {
        /**
         * Case list must be a block or tuple.
         */
        expect(execute("when a")).to.eql(ERROR("invalid list"));
        expect(execute("when []")).to.eql(ERROR("invalid list"));
        expect(execute("when {$a}")).to.eql(ERROR("invalid list"));
      });
    });

    mochadoc.section("Control flow", () => {
      mochadoc.description(() => {
        /**
         * If a test or script returns a result code other than `OK` then it
         * should be propagated properly by the command.
         */
      });

      describe("`return`", () => {
        it("should interrupt tests with `RETURN` code", () => {
          expect(
            execute("when {{return val; unreachable} {unreachable}}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute("when {false {} {return val; unreachable} {unreachable}}")
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt script command with `RETURN` code", () => {
          expect(
            execute("when {return val; unreachable} {true {unreachable}}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "set count 0; when {if {$count == 1} {return val; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt bodies with `RETURN` code", () => {
          expect(execute("when {true {return val; unreachable}}")).to.eql(
            RETURN(STR("val"))
          );
          expect(
            execute("when {false {} true {return val; unreachable}}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute("when {false {} false {} {return val; unreachable}}")
          ).to.eql(RETURN(STR("val")));
        });
      });
      describe("`tailcall`", () => {
        it("should interrupt tests with `RETURN` code", () => {
          expect(
            execute("when {{tailcall {idem val}; unreachable} {unreachable}}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "when {false {} {tailcall {idem val}; unreachable} {unreachable}}"
            )
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt script command with `RETURN` code", () => {
          expect(
            execute(
              "when {tailcall {idem val}; unreachable} {true {unreachable}}"
            )
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "set count 0; when {if {$count == 1} {tailcall {idem val}; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(RETURN(STR("val")));
        });
        it("should interrupt bodies with `RETURN` code", () => {
          expect(
            execute("when {true {tailcall {idem val}; unreachable}}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute("when {false {} true {tailcall {idem val}; unreachable}}")
          ).to.eql(RETURN(STR("val")));
          expect(
            execute(
              "when {false {} false {} {tailcall {idem val}; unreachable}}"
            )
          ).to.eql(RETURN(STR("val")));
        });
      });
      describe("`yield`", () => {
        it("should interrupt tests with `YIELD` code", () => {
          expect(
            execute("when {{yield; unreachable} {unreachable}}").code
          ).to.eql(ResultCode.YIELD);
          expect(
            execute("when {false {} {yield; unreachable} {unreachable}}").code
          ).to.eql(ResultCode.YIELD);
        });
        it("should interrupt script commands with YIELD code", () => {
          expect(
            execute("when {yield; unreachable} {true {unreachable}}").code
          ).to.eql(ResultCode.YIELD);
          expect(
            execute(
              "set count 0; when {if {$count == 1} {yield; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            ).code
          ).to.eql(ResultCode.YIELD);
        });
        it("should interrupt bodies with `YIELD` code", () => {
          expect(execute("when {true {yield; unreachable}}").code).to.eql(
            ResultCode.YIELD
          );
          expect(
            execute("when {false {} true {yield; unreachable}}").code
          ).to.eql(ResultCode.YIELD);
          expect(
            execute("when {false {} false {} {yield; unreachable}}").code
          ).to.eql(ResultCode.YIELD);
        });
        describe("should provide a resumable state", () => {
          describe("no command", () => {
            let process;
            beforeEach(() => {
              process = prepareScript(
                "when {{yield test1} {yield body1} {yield test2} {yield body2} {yield body3}}"
              );
            });
            specify("first", () => {
              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test1"));

              process.yieldBack(TRUE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("body1"));

              process.yieldBack(STR("result"));
              result = process.run();
              expect(result).to.eql(OK(STR("result")));
            });
            specify("second", () => {
              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test1"));

              process.yieldBack(FALSE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test2"));

              process.yieldBack(TRUE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("body2"));

              process.yieldBack(STR("result"));
              result = process.run();
              expect(result).to.eql(OK(STR("result")));
            });
            specify("default", () => {
              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test1"));

              process.yieldBack(FALSE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test2"));

              process.yieldBack(FALSE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("body3"));

              process.yieldBack(STR("result"));
              result = process.run();
              expect(result).to.eql(OK(STR("result")));
            });
          });
          describe("script command", () => {
            let process;
            beforeEach(() => {
              evaluate("macro test {v} {yield $v}");
              process = prepareScript(
                "when {yield command} {test1 {yield body1} test2 {yield body2} {yield body3}}"
              );
            });
            specify("first", () => {
              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("command"));

              process.yieldBack(STR("test"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test1"));

              process.yieldBack(TRUE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("body1"));

              process.yieldBack(STR("result"));
              result = process.run();
              expect(result).to.eql(OK(STR("result")));
            });
            specify("second", () => {
              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("command"));

              process.yieldBack(STR("test"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test1"));

              process.yieldBack(FALSE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("command"));

              process.yieldBack(STR("test"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test2"));

              process.yieldBack(TRUE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("body2"));

              process.yieldBack(STR("result"));
              result = process.run();
              expect(result).to.eql(OK(STR("result")));
            });
            specify("default", () => {
              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("command"));

              process.yieldBack(STR("test"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test1"));

              process.yieldBack(FALSE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("command"));

              process.yieldBack(STR("test"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("test2"));

              process.yieldBack(FALSE);
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(STR("body3"));

              process.yieldBack(STR("result"));
              result = process.run();
              expect(result).to.eql(OK(STR("result")));
            });
          });
        });
      });
      describe("`error`", () => {
        it("should interrupt tests with `ERROR` code", () => {
          expect(
            execute("when {{error msg; unreachable} {unreachable}}")
          ).to.eql(ERROR("msg"));
          expect(
            execute("when {false {} {error msg; unreachable} {unreachable}}")
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt script command with `ERROR` code", () => {
          expect(
            execute("when {error msg; unreachable} {true {unreachable}}")
          ).to.eql(ERROR("msg"));
          expect(
            execute(
              "set count 0; when {if {$count == 1} {error msg; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt bodies with `ERROR` code", () => {
          expect(execute("when {true {error msg; unreachable}}")).to.eql(
            ERROR("msg")
          );
          expect(
            execute("when {false {} true {error msg; unreachable}}")
          ).to.eql(ERROR("msg"));
          expect(
            execute("when {false {} false {} {error msg; unreachable}}")
          ).to.eql(ERROR("msg"));
        });
      });
      describe("`break`", () => {
        it("should interrupt tests with `BREAK` code", () => {
          expect(execute("when {{break; unreachable} {unreachable}}")).to.eql(
            BREAK()
          );
          expect(
            execute("when {false {} {break; unreachable} {unreachable}}")
          ).to.eql(BREAK());
        });
        it("should interrupt script command with `BREAK` code", () => {
          expect(
            execute("when {break; unreachable} {true {unreachable}}")
          ).to.eql(BREAK());
          expect(
            execute(
              "set count 0; when {if {$count == 1} {break; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(BREAK());
        });
        it("should interrupt bodies with `BREAK` code", () => {
          expect(execute("when {true {break; unreachable}}")).to.eql(BREAK());
          expect(execute("when {false {} true {break; unreachable}}")).to.eql(
            BREAK()
          );
          expect(
            execute("when {false {} false {} {break; unreachable}}")
          ).to.eql(BREAK());
        });
      });
      describe("`continue`", () => {
        it("should interrupt tests with `CONTINUE` code", () => {
          expect(
            execute("when {{continue; unreachable} {unreachable}}")
          ).to.eql(CONTINUE());
          expect(
            execute("when {false {} {continue; unreachable} {unreachable}}")
          ).to.eql(CONTINUE());
        });
        it("should interrupt script command with `BREAK` code", () => {
          expect(
            execute("when {continue; unreachable} {true {unreachable}}")
          ).to.eql(CONTINUE());
          expect(
            execute(
              "set count 0; when {if {$count == 1} {continue; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(CONTINUE());
        });
        it("should interrupt bodies with `CONTINUE` code", () => {
          expect(execute("when {true {continue; unreachable}}")).to.eql(
            CONTINUE()
          );
          expect(
            execute("when {false {} true {continue; unreachable}}")
          ).to.eql(CONTINUE());
          expect(
            execute("when {false {} false {} {continue; unreachable}}")
          ).to.eql(CONTINUE());
        });
      });
    });
  });

  describeCommand("catch", () => {
    mochadoc.summary("Result handling");
    mochadoc.usage(usage("catch"));
    mochadoc.description(() => {
      /**
       * The `catch` command is used to intercept specific result codes with
       * handler scripts.
       *
       * It is inspired by the Tcl command `catch` but with a distinct syntax.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help catch")).to.eql(
          STR(
            "catch body ?return value handler? ?yield value handler? ?error message handler? ?break handler? ?continue handler? ?finally handler?"
          )
        );
      });
    });

    describe("without handler", () => {
      specify("`OK` code should return `(ok value)` tuple", () => {
        expect(execute("catch {}")).to.eql(execute("tuple (ok [])"));
        expect(execute("catch {idem value}")).to.eql(
          execute("tuple (ok value)")
        );
      });
      specify("`RETURN` code should return `(return value)` tuple", () => {
        expect(execute("catch {return}")).to.eql(execute("tuple (return [])"));
        expect(execute("catch {return value}")).to.eql(
          execute("tuple (return value)")
        );
      });
      specify("`YIELD` code should return `(yield value)` tuple", () => {
        expect(execute("catch {yield}")).to.eql(execute("tuple (yield [])"));
        expect(execute("catch {yield}")).to.eql(execute("tuple (yield [])"));
        expect(execute("catch {yield value}")).to.eql(
          execute("tuple (yield value)")
        );
      });
      specify("`ERROR` code should return `(error message)` tuple", () => {
        expect(execute("catch {error value}")).to.eql(
          execute("tuple (error value)")
        );
        expect(execute("catch {error value}")).to.eql(
          execute("tuple (error value)")
        );
      });
      specify("`BREAK` code should return `(break)` tuple", () => {
        expect(execute("catch {break}")).to.eql(execute("tuple (break)"));
      });
      specify("`CONTINUE` code should return `(continue)` tuple", () => {
        expect(execute("catch {continue}")).to.eql(execute("tuple (continue)"));
      });
      specify("arbitrary errors", () => {
        expect(execute("catch {idem}")).to.eql(
          execute('tuple (error "wrong # args: should be \\"idem value\\"")')
        );
        expect(execute("catch {get var}")).to.eql(
          execute('tuple (error "cannot get \\"var\\": no such variable")')
        );
        expect(execute("catch {cmd a b}")).to.eql(
          execute('tuple (error "cannot resolve command \\"cmd\\"")')
        );
      });
    });

    describe("`return` handler", () => {
      it("should catch `RETURN` code", () => {
        evaluate("catch {return} return res {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should let other codes pass through", () => {
        expect(execute("catch {idem value} return res {unreachable}")).to.eql(
          OK(STR("value"))
        );
        expect(execute("catch {yield value} return res {unreachable}")).to.eql(
          YIELD(STR("value"))
        );
        expect(
          execute("catch {error message} return res {unreachable}")
        ).to.eql(ERROR("message"));
        expect(execute("catch {break} return res {unreachable}")).to.eql(
          BREAK()
        );
        expect(execute("catch {continue} return res {unreachable}")).to.eql(
          CONTINUE()
        );
      });
      it("should return handler result", () => {
        expect(evaluate("catch {return} return res {idem handler}")).to.eql(
          STR("handler")
        );
      });
      specify("handler value should be handler-local", () => {
        expect(evaluate("catch {return value} return res {idem _$res}")).to.eql(
          STR("_value")
        );
        expect(evaluate("exists res")).to.eql(FALSE);
      });
      describe("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {return val} return res {return handler; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {return val} return res {return handler; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {return val} return res {tailcall {idem handler}; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {return val} return res {tailcall {idem handler}; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt handler with `YIELD` code", () => {
            expect(
              execute("catch {return val} return res {yield; unreachable}").code
            ).to.eql(ResultCode.YIELD);
          });
          it("should provide a resumable state", () => {
            const process = prepareScript(
              "catch {return val} return res {idem _$[yield handler]}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("handler"));
            expect(result.data).to.exist;

            process.yieldBack(STR("value"));
            result = process.run();
            expect(result).to.eql(OK(STR("_value")));
          });
          it("should not bypass `finally` handler", () => {
            const process = prepareScript(
              "catch {return val} return res {yield; idem handler} finally {set var finally}"
            );

            let result = process.run();
            result = process.run();
            expect(result).to.eql(OK(STR("handler")));
            expect(evaluate("get var")).to.eql(STR("finally"));
          });
        });
        describe("`error`", () => {
          it("should interrupt handler with `ERROR` code", () => {
            expect(
              execute(
                "catch {return val} return res {error message; unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {return val} return res {error message; unreachable} finally {unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
        });
        describe("`break`", () => {
          it("should interrupt handler with `BREAK` code", () => {
            expect(
              execute("catch {return val} return res {break; unreachable}")
            ).to.eql(BREAK());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {return val} return res {break; unreachable} finally {unreachable}"
              )
            ).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt handler with `CONTINUE` code", () => {
            expect(
              execute("catch {return val} return res {continue; unreachable}")
            ).to.eql(CONTINUE());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {return val} return res {continue; unreachable} finally {unreachable}"
              )
            ).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * `return` must be followed by a parameter and a body script.
           */
          expect(execute("catch {} return")).to.eql(
            ERROR("wrong #args: missing return handler parameter")
          );
          expect(execute("catch {} return a")).to.eql(
            ERROR("wrong #args: missing return handler body")
          );
        });
        specify("invalid parameter name", () => {
          expect(execute("catch {} return [] {}")).to.eql(
            ERROR("invalid return handler parameter name")
          );
        });
      });
    });

    describe("`yield` handler", () => {
      it("should catch `YIELD` code", () => {
        evaluate("catch {yield} yield res {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should let other codes pass through", () => {
        expect(execute("catch {idem value} yield res {unreachable}")).to.eql(
          OK(STR("value"))
        );
        expect(execute("catch {return value} yield res {unreachable}")).to.eql(
          RETURN(STR("value"))
        );
        expect(execute("catch {error message} yield res {unreachable}")).to.eql(
          ERROR("message")
        );
        expect(execute("catch {break} yield res {unreachable}")).to.eql(
          BREAK()
        );
        expect(execute("catch {continue} yield res {unreachable}")).to.eql(
          CONTINUE()
        );
      });
      it("should return handler result", () => {
        expect(evaluate("catch {yield} yield res {idem handler}")).to.eql(
          STR("handler")
        );
      });
      specify("handler value should be handler-local", () => {
        expect(evaluate("catch {yield value} yield res {idem _$res}")).to.eql(
          STR("_value")
        );
        expect(evaluate("exists res")).to.eql(FALSE);
      });

      describe("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {yield val} yield res {return handler; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {yield val} yield res {return handler; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {yield val} yield res {tailcall {idem handler}; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {yield val} yield res {tailcall {idem handler}; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt handler with `YIELD` code", () => {
            expect(
              execute("catch {yield val} yield res {yield; unreachable}").code
            ).to.eql(ResultCode.YIELD);
          });
          it("should provide a resumable state", () => {
            const process = prepareScript(
              "catch {yield val} yield res {idem _$[yield handler]}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("handler"));
            expect(result.data).to.exist;

            process.yieldBack(STR("value"));
            result = process.run();
            expect(result).to.eql(OK(STR("_value")));
          });
          it("should not bypass `finally` handler", () => {
            const process = prepareScript(
              "catch {yield val} yield res {yield; idem handler} finally {set var finally}"
            );

            let result = process.run();
            result = process.run();
            expect(result).to.eql(OK(STR("handler")));
            expect(evaluate("get var")).to.eql(STR("finally"));
          });
        });
        describe("`error`", () => {
          it("should interrupt handler with `ERROR` code", () => {
            expect(
              execute(
                "catch {yield val} yield res {error message; unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {yield val} yield res {error message; unreachable} finally {unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
        });
        describe("`break`", () => {
          it("should interrupt handler with `BREAK` code", () => {
            expect(
              execute("catch {yield val} yield res {break; unreachable}")
            ).to.eql(BREAK());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {yield val} yield res {break; unreachable} finally {unreachable}"
              )
            ).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt handler with `CONTINUE` code", () => {
            expect(
              execute("catch {yield val} yield res {continue; unreachable}")
            ).to.eql(CONTINUE());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {yield val} yield res {continue; unreachable} finally {unreachable}"
              )
            ).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * `yield` must be followed by a parameter and a body script.
           */
          expect(execute("catch {} yield")).to.eql(
            ERROR("wrong #args: missing yield handler parameter")
          );
          expect(execute("catch {} yield a")).to.eql(
            ERROR("wrong #args: missing yield handler body")
          );
        });
        specify("invalid parameter name", () => {
          expect(execute("catch {} yield [] {}")).to.eql(
            ERROR("invalid yield handler parameter name")
          );
        });
      });
    });

    describe("`error` handler", () => {
      it("should catch `ERROR` code", () => {
        evaluate("catch {error message} error msg {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should let other codes pass through", () => {
        expect(execute("catch {idem value} error msg {unreachable}")).to.eql(
          OK(STR("value"))
        );
        expect(execute("catch {return value} error msg {unreachable}")).to.eql(
          RETURN(STR("value"))
        );
        expect(execute("catch {yield value} error msg {unreachable}")).to.eql(
          YIELD(STR("value"))
        );
        expect(execute("catch {break} error msg {unreachable}")).to.eql(
          BREAK()
        );
        expect(execute("catch {continue} error msg {unreachable}")).to.eql(
          CONTINUE()
        );
      });
      it("should return handler result", () => {
        expect(
          evaluate("catch {error message} error msg {idem handler}")
        ).to.eql(STR("handler"));
      });
      specify("handler value should be handler-local", () => {
        expect(evaluate("catch {error message} error msg {idem _$msg}")).to.eql(
          STR("_message")
        );
        expect(evaluate("exists msg")).to.eql(FALSE);
      });
      describe("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {error message} error msg {return handler; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {error message} error msg {return handler; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {error message} error msg {tailcall {idem handler}; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {error message} error msg {tailcall {idem handler}; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt handler with `YIELD` code", () => {
            expect(
              execute("catch {error message} error msg {yield; unreachable}")
                .code
            ).to.eql(ResultCode.YIELD);
          });
          it("should provide a resumable state", () => {
            const process = prepareScript(
              "catch {error message} error msg {idem _$[yield handler]}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("handler"));
            expect(result.data).to.exist;

            process.yieldBack(STR("value"));
            result = process.run();
            expect(result).to.eql(OK(STR("_value")));
          });
          it("should not bypass `finally` handler", () => {
            const process = prepareScript(
              "catch {error message} error msg {yield; idem handler} finally {set var finally}"
            );

            let result = process.run();
            result = process.run();
            expect(result).to.eql(OK(STR("handler")));
            expect(evaluate("get var")).to.eql(STR("finally"));
          });
        });
        describe("`error`", () => {
          it("should interrupt handler with `ERROR` code", () => {
            expect(
              execute(
                "catch {error message} error msg {error message; unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {error message} error msg {error message; unreachable} finally {unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
        });
        describe("`break`", () => {
          it("should interrupt handler with `BREAK` code", () => {
            expect(
              execute("catch {error message} error msg {break; unreachable}")
            ).to.eql(BREAK());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {error message} error msg {break; unreachable} finally {unreachable}"
              )
            ).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt handler with `CONTINUE` code", () => {
            expect(
              execute("catch {error message} error msg {continue; unreachable}")
            ).to.eql(CONTINUE());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {error message} error msg {continue; unreachable} finally {unreachable}"
              )
            ).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * `error` must be followed by a parameter and a body script.
           */
          expect(execute("catch {} error")).to.eql(
            ERROR("wrong #args: missing error handler parameter")
          );
          expect(execute("catch {} error a")).to.eql(
            ERROR("wrong #args: missing error handler body")
          );
        });
        specify("invalid parameter name", () => {
          expect(execute("catch {} error [] {}")).to.eql(
            ERROR("invalid error handler parameter name")
          );
        });
      });
    });

    describe("`break` handler", () => {
      it("should catch `BREAK` code", () => {
        evaluate("catch {break} break {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should let other codes pass through", () => {
        expect(execute("catch {idem value} break {unreachable}")).to.eql(
          OK(STR("value"))
        );
        expect(execute("catch {return value} break {unreachable}")).to.eql(
          RETURN(STR("value"))
        );
        expect(execute("catch {yield value} break {unreachable}")).to.eql(
          YIELD(STR("value"))
        );
        expect(execute("catch {error message} break {unreachable}")).to.eql(
          ERROR("message")
        );
        expect(execute("catch {continue} break {unreachable}")).to.eql(
          CONTINUE()
        );
      });
      it("should return handler result", () => {
        expect(evaluate("catch {break} break {idem handler}")).to.eql(
          STR("handler")
        );
      });
      describe("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute("catch {break} break {return handler; unreachable}")
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {break} break {return handler; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {break} break {tailcall {idem handler}; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {break} break {tailcall {idem handler}; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt handler with `YIELD` code", () => {
            expect(
              execute("catch {break} break {yield; unreachable}").code
            ).to.eql(ResultCode.YIELD);
          });
          it("should provide a resumable state", () => {
            const process = prepareScript(
              "catch {break} break {idem _$[yield handler]}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("handler"));
            expect(result.data).to.exist;

            process.yieldBack(STR("value"));
            result = process.run();
            expect(result).to.eql(OK(STR("_value")));
          });
          it("should not bypass `finally` handler", () => {
            const process = prepareScript(
              "catch {break} break {yield; idem handler} finally {set var finally}"
            );

            let result = process.run();
            result = process.run();
            expect(result).to.eql(OK(STR("handler")));
            expect(evaluate("get var")).to.eql(STR("finally"));
          });
        });
        describe("`error`", () => {
          it("should interrupt handler with `ERROR` code", () => {
            expect(
              execute("catch {break} break {error message; unreachable}")
            ).to.eql(ERROR("message"));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {break} break {error message; unreachable} finally {unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
        });
        describe("`break`", () => {
          it("should interrupt handler with `BREAK` code", () => {
            expect(execute("catch {break} break {break; unreachable}")).to.eql(
              BREAK()
            );
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {break} break {break; unreachable} finally {unreachable}"
              )
            ).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt handler with `CONTINUE` code", () => {
            expect(
              execute("catch {break} break {continue; unreachable}")
            ).to.eql(CONTINUE());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {break} break {continue; unreachable} finally {unreachable}"
              )
            ).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * `break` must be followed by a body script.
           */
          expect(execute("catch {} break")).to.eql(
            ERROR("wrong #args: missing break handler body")
          );
        });
      });
    });

    describe("`continue` handler", () => {
      it("should catch `CONTINUE` code", () => {
        evaluate("catch {continue} continue {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should let other codes pass through", () => {
        expect(execute("catch {idem value} continue {unreachable}")).to.eql(
          OK(STR("value"))
        );
        expect(execute("catch {return value} continue {unreachable}")).to.eql(
          RETURN(STR("value"))
        );
        expect(execute("catch {yield value} continue {unreachable}")).to.eql(
          YIELD(STR("value"))
        );
        expect(execute("catch {error message} continue {unreachable}")).to.eql(
          ERROR("message")
        );
        expect(execute("catch {break} continue {unreachable}")).to.eql(BREAK());
      });
      it("should return handler result", () => {
        expect(evaluate("catch {continue} continue {idem handler}")).to.eql(
          STR("handler")
        );
      });
      describe("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute("catch {continue} continue {return handler; unreachable}")
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {continue} continue {return handler; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {continue} continue {tailcall {idem handler}; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {continue} continue {tailcall {idem handler}; unreachable} finally {unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt handler with `YIELD` code", () => {
            expect(
              execute("catch {continue} continue {yield; unreachable}").code
            ).to.eql(ResultCode.YIELD);
          });
          it("should provide a resumable state", () => {
            const process = prepareScript(
              "catch {continue} continue {idem _$[yield handler]}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("handler"));
            expect(result.data).to.exist;

            process.yieldBack(STR("value"));
            result = process.run();
            expect(result).to.eql(OK(STR("_value")));
          });
          it("should not bypass `finally` handler", () => {
            const process = prepareScript(
              "catch {continue} continue {yield; idem handler} finally {set var finally}"
            );

            let result = process.run();
            result = process.run();
            expect(result).to.eql(OK(STR("handler")));
            expect(evaluate("get var")).to.eql(STR("finally"));
          });
        });
        describe("`error`", () => {
          it("should interrupt handler with `ERROR` code", () => {
            expect(
              execute("catch {continue} continue {error message; unreachable}")
            ).to.eql(ERROR("message"));
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {continue} continue {error message; unreachable} finally {unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
        });
        describe("`break`", () => {
          it("should interrupt handler with `BREAK` code", () => {
            expect(
              execute("catch {continue} continue {break; unreachable}")
            ).to.eql(BREAK());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {continue} continue {break; unreachable} finally {unreachable}"
              )
            ).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt handler with `CONTINUE` code", () => {
            expect(
              execute("catch {continue} continue {continue; unreachable}")
            ).to.eql(CONTINUE());
          });
          it("should bypass `finally` handler", () => {
            expect(
              execute(
                "catch {continue} continue {continue; unreachable} finally {unreachable}"
              )
            ).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * `continue` must be followed by a body script.
           */
          expect(execute("catch {} continue")).to.eql(
            ERROR("wrong #args: missing continue handler body")
          );
        });
      });
    });

    describe("`finally` handler", () => {
      it("should execute for `OK` code", () => {
        evaluate("catch {idem value} finally {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should execute for `RETURN` code", () => {
        evaluate("catch {return} finally {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should execute for `YIELD` code", () => {
        evaluate("catch {yield} finally {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should execute for `ERROR` code", () => {
        evaluate("catch {error message} finally {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should execute for `BREAK` code", () => {
        evaluate("catch {break} finally {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should execute for `CONTINUE` code", () => {
        evaluate("catch {continue} finally {set var handler}");
        expect(evaluate("get var")).to.eql(STR("handler"));
      });
      it("should let all codes pass through", () => {
        expect(execute("catch {idem value} finally {idem handler}")).to.eql(
          OK(STR("value"))
        );
        expect(execute("catch {return value} finally {idem handler}")).to.eql(
          RETURN(STR("value"))
        );
        expect(execute("catch {yield value} finally {idem handler}")).to.eql(
          YIELD(STR("value"))
        );
        expect(execute("catch {error message} finally {idem handler}")).to.eql(
          ERROR("message")
        );
        expect(execute("catch {break} finally {idem handler}")).to.eql(BREAK());
        expect(execute("catch {continue} finally {idem handler}")).to.eql(
          CONTINUE()
        );
      });

      describe("Control flow", () => {
        describe("`return`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {error message} finally {return handler; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt handler with `RETURN` code", () => {
            expect(
              execute(
                "catch {error message} finally {tailcall {idem handler}; unreachable}"
              )
            ).to.eql(RETURN(STR("handler")));
          });
        });
        describe("`yield`", () => {
          it("should interrupt handler with `YIELD` code", () => {
            expect(
              execute("catch {error message} finally {yield; unreachable}").code
            ).to.eql(ResultCode.YIELD);
          });
          it("should provide a resumable state", () => {
            const process = prepareScript(
              "catch {error message} finally {idem _$[yield handler]}"
            );

            let result = process.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(STR("handler"));
            expect(result.data).to.exist;

            process.yieldBack(STR("value"));
            result = process.run();
            expect(result).to.eql(ERROR("message"));
          });
        });
        describe("`error`", () => {
          it("should interrupt handler with `ERROR` code", () => {
            expect(
              execute(
                "catch {error message} finally {error message; unreachable}"
              )
            ).to.eql(ERROR("message"));
          });
        });
        describe("`break`", () => {
          it("should interrupt handler with `BREAK` code", () => {
            expect(
              execute("catch {error message} finally {break; unreachable}")
            ).to.eql(BREAK());
          });
        });
        describe("`continue`", () => {
          it("should interrupt handler with `CONTINUE` code", () => {
            expect(
              execute("catch {error message} finally {continue; unreachable}")
            ).to.eql(CONTINUE());
          });
        });
      });

      describe("Exceptions", () => {
        specify("wrong arity", () => {
          /**
           * `finally` must be followed by a body script.
           */
          expect(execute("catch {} finally")).to.eql(
            ERROR("wrong #args: missing finally handler body")
          );
        });
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("catch")).to.eql(
          ERROR(
            'wrong # args: should be "catch body ?return value handler? ?yield value handler? ?error message handler? ?break handler? ?continue handler? ?finally handler?"'
          )
        );
      });
      specify("non-script body", () => {
        expect(execute("catch a")).to.eql(ERROR("body must be a script"));
        expect(execute("catch []")).to.eql(ERROR("body must be a script"));
        expect(execute("catch [1]")).to.eql(ERROR("body must be a script"));
      });
      specify("invalid keyword", () => {
        /**
         * Only standard result codes and `finally` are accepted.
         */
        expect(execute("catch {} foo {}")).to.eql(
          ERROR('invalid keyword "foo"')
        );
        expect(execute("catch {} [] {}")).to.eql(ERROR("invalid keyword"));
      });
    });
  });

  describeCommand("pass", () => {
    mochadoc.summary("`catch` handler pass-through");
    mochadoc.usage(usage("pass"));
    mochadoc.description(() => {
      /**
       * `pass` is used within `catch` handlers to let the original result pass
       * through to the caller.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help pass")).to.eql(STR("pass"));
      });

      specify("result code should be the custom code `pass`", () => {
        expect(RESULT_CODE_NAME(execute("pass"))).to.eql("pass");
      });
      specify("`catch` should return `(pass)` tuple", () => {
        expect(execute("catch {pass}")).to.eql(execute("tuple (pass)"));
      });
      specify("`catch` handlers should not handle it", () => {
        expect(
          RESULT_CODE_NAME(
            execute(`
              catch {pass} \\
                return value {unreachable} \\
                yield value {unreachable} \\
                error message {unreachable} \\
                break {unreachable} \\
                continue {unreachable} \\
            `)
          )
        ).to.eql("pass");
      });
      describe("should interrupt `catch` handlers and let original result pass through", () => {
        specify("`RETURN`", () => {
          expect(
            execute("catch {return value} return res {pass; unreachable}")
          ).to.eql(RETURN(STR("value")));
        });
        specify("`YIELD`", () => {
          const result = execute(
            "catch {yield value} yield res {pass; unreachable}"
          );
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("value"));
        });
        specify("`ERROR`", () => {
          expect(
            execute("catch {error message} error msg {pass; unreachable}")
          ).to.eql(ERROR("message"));
        });
        specify("`BREAK`", () => {
          expect(execute("catch {break} break {pass; unreachable}")).to.eql(
            BREAK()
          );
        });
        specify("`CATCH`", () => {
          expect(
            execute("catch {continue} continue {pass; unreachable}")
          ).to.eql(CONTINUE());
        });
      });
      describe("should let `catch` `finally` handler execute", () => {
        specify("`RETURN`", () => {
          expect(
            execute(
              "catch {return value} return res {pass} finally {set var handler}"
            )
          ).to.eql(RETURN(STR("value")));
          expect(evaluate("get var")).to.eql(STR("handler"));
        });
        specify("`YIELD`", () => {
          const process = prepareScript(
            "catch {yield value} yield res {pass} finally {set var handler}"
          );

          const result = process.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(STR("value"));

          process.run();
          expect(evaluate("get var")).to.eql(STR("handler"));
        });
        specify("`ERROR`", () => {
          expect(
            execute(
              "catch {error message} error msg {pass} finally {set var handler}"
            )
          ).to.eql(ERROR("message"));
          expect(evaluate("get var")).to.eql(STR("handler"));
        });
        specify("`BREAK`", () => {
          expect(
            execute("catch {break} break {pass} finally {set var handler}")
          ).to.eql(BREAK());
          expect(evaluate("get var")).to.eql(STR("handler"));
        });
        specify("`CONTINUE`", () => {
          expect(
            execute(
              "catch {continue} continue {pass} finally {set var handler}"
            )
          ).to.eql(CONTINUE());
          expect(evaluate("get var")).to.eql(STR("handler"));
        });
      });
      it("should resume yielded body", () => {
        const process = prepareScript(
          "catch {set var [yield step1]; idem _$[yield step2]} yield res {pass}"
        );

        let result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("step1"));
        expect(result.data).to.exist;

        process.yieldBack(STR("value1"));
        result = process.run();
        expect(result.code).to.eql(ResultCode.YIELD);
        expect(result.value).to.eql(STR("step2"));
        expect(result.data).to.exist;
        expect(evaluate("get var")).to.eql(STR("value1"));

        process.yieldBack(STR("value2"));
        result = process.run();
        expect(result).to.eql(OK(STR("_value2")));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("pass a")).to.eql(
          ERROR('wrong # args: should be "pass"')
        );
        expect(execute("help pass a")).to.eql(
          ERROR('wrong # args: should be "pass"')
        );
      });
      specify("invalid `pass` handler", () => {
        /**
         * `pass` is not a valid `catch` handler.
         */
        expect(execute("catch {pass} pass {}")).to.eql(
          ERROR('invalid keyword "pass"')
        );
      });
    });
  });
});
