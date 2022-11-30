import { expect } from "chai";
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
import { FALSE, IntegerValue, NIL, StringValue, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena control flow commands", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  beforeEach(() => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("while", () => {
    it("should skip the body when test is false", () => {
      expect(execute("while false {unreachable}").code).to.eql(ResultCode.OK);
    });
    it("should loop over the body while test is true", () => {
      evaluate("set i 0; while {$i < 10} {set i [+ $i 1]}");
      expect(evaluate("get i")).to.eql(new IntegerValue(10));
    });
    it("should return the result of the last command", () => {
      expect(execute(" while false {}")).to.eql(OK(NIL));
      expect(
        evaluate("set i 0; while {$i < 10} {set i [+ $i 1]; idem val$i}")
      ).to.eql(new StringValue("val10"));
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt the test with RETURN code", () => {
          expect(
            execute("while {return val; unreachable} {unreachable}")
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt the loop with RETURN code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; return val; unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("tailcall", () => {
        it("should interrupt the test with RETURN code", () => {
          expect(
            execute("while {tailcall {idem val}; unreachable} {unreachable}")
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt the loop with RETURN code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; tailcall {idem val}; unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("yield", () => {
        it("should interrupt the test with YIELD code", () => {
          expect(execute("while {yield; unreachable} {}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should interrupt the body with YIELD code", () => {
          expect(execute("while {true} {yield; unreachable}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should provide a resumable state", () => {
          const state = rootScope.prepareScript(
            parse("while {yield test} {yield body}")
          );

          let result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("test"));
          expect(result.data).to.exist;

          state.yieldBack(TRUE);
          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("body"));
          expect(result.data).to.exist;

          state.yieldBack(new StringValue("step 1"));
          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("test"));
          expect(result.data).to.exist;

          state.yieldBack(TRUE);
          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("body"));
          expect(result.data).to.exist;

          state.yieldBack(new StringValue("step 2"));
          result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("test"));
          expect(result.data).to.exist;

          state.yieldBack(FALSE);
          result = state.run();
          expect(result.code).to.eql(ResultCode.OK);
          expect(result.value).to.eql(new StringValue("step 2"));
        });
      });
      describe("error", () => {
        it("should interrupt the test with ERROR code", () => {
          expect(
            execute("while {error msg; set var val} {unreachable}")
          ).to.eql(ERROR("msg"));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
        it("should interrupt the loop with ERROR code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; error msg; set var val}"
            )
          ).to.eql(ERROR("msg"));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
      });
      describe("break", () => {
        it("should interrupt the test with BREAK code", () => {
          expect(execute("while {break; unreachable} {unreachable}")).to.eql(
            BREAK()
          );
        });
        it("should interrupt the body with nil result", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; break; unreachable}"
            )
          ).to.eql(OK(NIL));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("continue", () => {
        it("should interrupt the test with CONTINUE code", () => {
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
          expect(evaluate("get i")).to.eql(new IntegerValue(10));
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("while a")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
        expect(execute("while a b c")).to.eql(
          ERROR('wrong # args: should be "while test body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("while a b")).to.eql(ERROR("body must be a script"));
      });
    });
  });

  describe("if", () => {
    it("should return the result of the first true body", () => {
      expect(evaluate("if true {1}")).to.eql(new IntegerValue(1));
      expect(evaluate("if true {1} else {2}")).to.eql(new IntegerValue(1));
      expect(evaluate("if true {1} elseif true {2} else {3}")).to.eql(
        new IntegerValue(1)
      );
      expect(
        evaluate("if false {1} elseif true {2} elseif true {3} else {4}")
      ).to.eql(new IntegerValue(2));
      expect(evaluate("if false {1} elseif true {2} else {3}")).to.eql(
        new IntegerValue(2)
      );
      expect(
        evaluate("if false {1} elseif true {2} elseif true {3} else {4}")
      ).to.eql(new IntegerValue(2));
    });
    it("should return the result of the else body when all tests are false", () => {
      expect(evaluate("if false {1} else {2}")).to.eql(new IntegerValue(2));
      expect(evaluate("if false {1} elseif false {2} else {3}")).to.eql(
        new IntegerValue(3)
      );
      expect(
        evaluate("if false {1} elseif false {2} elseif false {3} else {4}")
      ).to.eql(new IntegerValue(4));
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
      expect(evaluate("if true {1} else {unreachable}")).to.eql(
        new IntegerValue(1)
      );
      expect(evaluate("if true {1} elseif {unreachable} {unreachable}")).to.eql(
        new IntegerValue(1)
      );
      expect(
        evaluate(
          "if true {1} elseif {unreachable} {unreachable} else {unreachable}"
        )
      ).to.eql(new IntegerValue(1));
      expect(
        evaluate(
          "if false {1} elseif true {2} elseif {unreachable} {unreachable}"
        )
      ).to.eql(new IntegerValue(2));
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt tests with RETURN code", () => {
          expect(execute("if {return val; unreachable} {unreachable}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute(
              "if false {} elseif {return val; unreachable} {unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt bodies with RETURN code", () => {
          expect(execute("if true {return val; unreachable}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute("if false {} elseif true {return val; unreachable}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "if false {} elseif false {} else {return val; unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt tests with RETURN code", () => {
          expect(
            execute("if {tailcall {idem val}; unreachable} {unreachable}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "if false {} elseif {tailcall {idem val}; unreachable} {unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt bodies with RETURN code", () => {
          expect(execute("if true {tailcall {idem val}; unreachable}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute(
              "if false {} elseif true {tailcall {idem val}; unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "if false {} elseif false {} else {tailcall {idem val}; unreachable}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("yield", () => {
        it("should interrupt tests with YIELD code", () => {
          it("should interrupt tests with ERROR code", () => {
            expect(
              execute("if {yield; unreachable} {unreachable}").code
            ).to.eql(ResultCode.YIELD);
            expect(
              execute("if false {} elseif {yield; unreachable} {unreachable}")
                .code
            ).to.eql(ResultCode.YIELD);
          });
        });
        it("should interrupt bodies with YIELD code", () => {
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
          let state;
          beforeEach(() => {
            state = rootScope.prepareScript(
              parse(
                "if {yield test1} {yield body1} elseif {yield test2} {yield body2} else {yield body3}"
              )
            );
          });
          specify("if", () => {
            let result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("test1"));
            expect(result.data).to.exist;

            state.yieldBack(TRUE);
            result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("body1"));
            expect(result.data).to.exist;

            state.yieldBack(new StringValue("result"));
            result = state.run();
            expect(result).to.eql(OK(new StringValue("result")));
          });
          specify("elseif", () => {
            let result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("test1"));
            expect(result.data).to.exist;

            state.yieldBack(FALSE);
            result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("test2"));
            expect(result.data).to.exist;

            state.yieldBack(TRUE);
            result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("body2"));
            expect(result.data).to.exist;

            state.yieldBack(new StringValue("result"));
            result = state.run();
            expect(result).to.eql(OK(new StringValue("result")));
          });
          specify("else", () => {
            let result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("test1"));
            expect(result.data).to.exist;

            state.yieldBack(FALSE);
            result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("test2"));
            expect(result.data).to.exist;

            state.yieldBack(FALSE);
            result = state.run();
            expect(result.code).to.eql(ResultCode.YIELD);
            expect(result.value).to.eql(new StringValue("body3"));
            expect(result.data).to.exist;

            state.yieldBack(new StringValue("result"));
            result = state.run();
            expect(result).to.eql(OK(new StringValue("result")));
          });
        });
      });
      describe("error", () => {
        it("should interrupt tests with ERROR code", () => {
          expect(execute("if {error msg; unreachable} {unreachable}")).to.eql(
            ERROR("msg")
          );
          expect(
            execute("if false {} elseif {error msg; unreachable} {unreachable}")
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt bodies with ERROR code", () => {
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
      describe("break", () => {
        it("should interrupt tests with BREAK code", () => {
          expect(execute("if {break; unreachable} {unreachable}")).to.eql(
            BREAK()
          );
          expect(
            execute("if false {} elseif {break; unreachable} {unreachable}")
          ).to.eql(BREAK());
        });
        it("should interrupt bodies with BREAK code", () => {
          expect(execute("if true {break; unreachable}")).to.eql(BREAK());
          expect(
            execute("if false {} elseif true {break; unreachable}")
          ).to.eql(BREAK());
          expect(
            execute("if false {} elseif false {} else {break; unreachable}")
          ).to.eql(BREAK());
        });
      });
      describe("continue", () => {
        it("should interrupt tests with CONTINUE code", () => {
          expect(execute("if {continue; unreachable} {unreachable}")).to.eql(
            CONTINUE()
          );
          expect(
            execute("if false {} elseif {continue; unreachable} {unreachable}")
          ).to.eql(CONTINUE());
        });
        it("should interrupt bodies with CONTINUE code", () => {
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
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("if")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
        expect(execute("if a")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
        expect(execute("if a b else")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
        expect(execute("if a b elseif")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
        expect(execute("if a b elseif c")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
        expect(execute("if a b elseif c d else")).to.eql(
          ERROR(
            'wrong # args: should be "if test body ?elseif test body ...? ?else? ?body?"'
          )
        );
      });
      specify("invalid keyword", () => {
        expect(execute("if a b elif c d")).to.eql(
          ERROR('invalid keyword "elif"')
        );
        expect(execute("if a b fi")).to.eql(ERROR('invalid keyword "fi"'));
      });
      specify("invalid test", () => {
        expect(execute("if a b")).to.eql(ERROR('invalid boolean "a"'));
        expect(execute("if false a elseif b c")).to.eql(
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
  });

  describe("when", () => {
    it("should return nil with empty test list", () => {
      expect(evaluate("when {}")).to.eql(NIL);
    });
    it("should accept tuple case list", () => {
      expect(evaluate("when ()")).to.eql(NIL);
    });
    it("should return the result of the first true body", () => {
      expect(evaluate("when {true {1}}")).to.eql(new IntegerValue(1));
      expect(evaluate("when {true {1} {2}}")).to.eql(new IntegerValue(1));
      expect(evaluate("when {true {1} true {2} {3}}")).to.eql(
        new IntegerValue(1)
      );
      expect(evaluate("when {false {1} true {2} true {3} {4}}")).to.eql(
        new IntegerValue(2)
      );
      expect(evaluate("when {false {1} true {2} {3}}")).to.eql(
        new IntegerValue(2)
      );
      expect(evaluate("when {false {1} true {2} true {3}  {4}}")).to.eql(
        new IntegerValue(2)
      );
    });
    it("should skip leading false bodies", () => {
      expect(evaluate("when {false {unreachable}}")).to.eql(NIL);
      expect(evaluate("when {false {unreachable} false {unreachable}}")).to.eql(
        NIL
      );
      expect(
        evaluate(
          "when {false {unreachable} false {unreachable} false {unreachable}}"
        )
      ).to.eql(NIL);
    });
    it("should skip trailing tests and bodies", () => {
      expect(evaluate("when {true {1} {unreachable}}")).to.eql(
        new IntegerValue(1)
      );
      expect(evaluate("when {true {1} {unreachable} {unreachable}}")).to.eql(
        new IntegerValue(1)
      );
      expect(
        evaluate("when {true {1} {unreachable} {unreachable} {unreachable}}")
      ).to.eql(new IntegerValue(1));
      expect(
        evaluate("when {false {1} true {2} {unreachable} {unreachable}}")
      ).to.eql(new IntegerValue(2));
    });
    describe("no command", () => {
      it("should evaluate tests as boolean conditions", () => {
        expect(evaluate("when {true {1}}")).to.eql(new IntegerValue(1));
        expect(evaluate("when {{idem true} {1}}")).to.eql(new IntegerValue(1));
      });
    });
    describe("literal command", () => {
      it("should apply to tests", () => {
        expect(evaluate("when ! {true {1}}")).to.eql(NIL);
        expect(evaluate("when ! {true {1} {2}}")).to.eql(new IntegerValue(2));
        expect(evaluate("when ! {true {1} true {2} {3}}")).to.eql(
          new IntegerValue(3)
        );
      });
      it("should be called on each test", () => {
        evaluate("macro test {v} {set count [+ $count 1]; idem $v}");
        evaluate("set count 0");
        expect(evaluate("when test {false {1} false {2} {3}}")).to.eql(
          new IntegerValue(3)
        );
        expect(evaluate("get count")).to.eql(new IntegerValue(2));
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
        expect(evaluate("when (1 ==) {2 {1} 1 {2} {3}}")).to.eql(
          new IntegerValue(2)
        );
      });
      it("should be called on each test", () => {
        evaluate("macro test {cmd v} {set count [+ $count 1]; $cmd $v}");
        evaluate("set count 0");
        expect(
          evaluate("when (test (true ?)) {false {1} false {2} {3}}")
        ).to.eql(new IntegerValue(3));
        expect(evaluate("get count")).to.eql(new IntegerValue(2));
      });
      it("should pass test literal as argument", () => {
        expect(evaluate("when (1 ==) {2 {1} 3 {2} 1 {3} {4}}")).to.eql(
          new IntegerValue(3)
        );
      });
      it("should pass test tuple values as arguments", () => {
        expect(evaluate("when () {false {1} true {2} {3}}")).to.eql(
          new IntegerValue(2)
        );
        expect(evaluate("when (1) {(== 2) {1} (!= 1) {2} {3}}")).to.eql(
          new IntegerValue(3)
        );
        expect(
          evaluate("when (&& true) {(true false) {1} (true) {2} {3}}")
        ).to.eql(new IntegerValue(2));
      });
    });
    describe("script command", () => {
      it("evaluation result should apply to tests", () => {
        evaluate("macro test {v} {idem $v}");
        expect(evaluate("when {idem test} {false {1} true {2} {3}}")).to.eql(
          new IntegerValue(2)
        );
      });
      it("should be called on each test", () => {
        evaluate("macro test {cmd} {set count [+ $count 1]; idem $cmd}");
        evaluate("set count 0");
        expect(evaluate("when {test !} {true {1} true {2} {3}}")).to.eql(
          new IntegerValue(3)
        );
        expect(evaluate("get count")).to.eql(new IntegerValue(2));
      });
      it("should pass test literal as argument", () => {
        evaluate("macro test {v} {1 == $v}");
        expect(evaluate("when {idem test} {2 {1} 3 {2} 1 {3} {4}}")).to.eql(
          new IntegerValue(3)
        );
      });
      it("should pass test tuple values as arguments", () => {
        evaluate("macro test {v1 v2} {$v1 == $v2}");
        expect(evaluate("when {idem test} {(1 2) {1} (1 1) {2} {3}}")).to.eql(
          new IntegerValue(2)
        );
        expect(evaluate("when {1} {(== 2) {1} (!= 1) {2} {3}}")).to.eql(
          new IntegerValue(3)
        );
        expect(
          evaluate("when {idem (&& true)} {(true false) {1} (true) {2} {3}}")
        ).to.eql(new IntegerValue(2));
      });
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt tests with RETURN code", () => {
          expect(
            execute("when {{return val; unreachable} {unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute("when {false {} {return val; unreachable} {unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt script command with RETURN code", () => {
          expect(
            execute("when {return val; unreachable} {true {unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "set count 0; when {if {$count == 1} {return val; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt bodies with RETURN code", () => {
          expect(execute("when {true {return val; unreachable}}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute("when {false {} true {return val; unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute("when {false {} false {} {return val; unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt tests with RETURN code", () => {
          expect(
            execute("when {{tailcall {idem val}; unreachable} {unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "when {false {} {tailcall {idem val}; unreachable} {unreachable}}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt script command with RETURN code", () => {
          expect(
            execute(
              "when {tailcall {idem val}; unreachable} {true {unreachable}}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "set count 0; when {if {$count == 1} {tailcall {idem val}; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt bodies with RETURN code", () => {
          expect(
            execute("when {true {tailcall {idem val}; unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute("when {false {} true {tailcall {idem val}; unreachable}}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "when {false {} false {} {tailcall {idem val}; unreachable}}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("yield", () => {
        it("should interrupt tests with YIELD code", () => {
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
        it("should interrupt bodies with YIELD code", () => {
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
            let state;
            beforeEach(() => {
              state = rootScope.prepareScript(
                parse(
                  "when {{yield test1} {yield body1} {yield test2} {yield body2} {yield body3}}"
                )
              );
            });
            specify("first", () => {
              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test1"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("body1"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("result"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("result")));
            });
            specify("second", () => {
              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test1"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test2"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("body2"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("result"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("result")));
            });
            specify("default", () => {
              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test1"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test2"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("body3"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("result"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("result")));
            });
          });
          describe("script command", () => {
            let state;
            beforeEach(() => {
              evaluate("macro test {v} {yield $v}");
              state = rootScope.prepareScript(
                parse(
                  "when {yield command} {test1 {yield body1} test2 {yield body2} {yield body3}}"
                )
              );
            });
            specify("first", () => {
              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("command"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("test"));
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test1"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("body1"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("result"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("result")));
            });
            specify("second", () => {
              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("command"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("test"));
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test1"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("command"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("test"));
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test2"));
              expect(result.data).to.exist;

              state.yieldBack(TRUE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("body2"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("result"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("result")));
            });
            specify("default", () => {
              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("command"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("test"));
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test1"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("command"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("test"));
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("test2"));
              expect(result.data).to.exist;

              state.yieldBack(FALSE);
              result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("body3"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("result"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("result")));
            });
          });
        });
      });
      describe("error", () => {
        it("should interrupt tests with ERROR code", () => {
          expect(
            execute("when {{error msg; unreachable} {unreachable}}")
          ).to.eql(ERROR("msg"));
          expect(
            execute("when {false {} {error msg; unreachable} {unreachable}}")
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt script command with ERROR code", () => {
          expect(
            execute("when {error msg; unreachable} {true {unreachable}}")
          ).to.eql(ERROR("msg"));
          expect(
            execute(
              "set count 0; when {if {$count == 1} {error msg; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt bodies with ERROR code", () => {
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
      describe("break", () => {
        it("should interrupt tests with BREAK code", () => {
          expect(execute("when {{break; unreachable} {unreachable}}")).to.eql(
            BREAK()
          );
          expect(
            execute("when {false {} {break; unreachable} {unreachable}}")
          ).to.eql(BREAK());
        });
        it("should interrupt script command with BREAK code", () => {
          expect(
            execute("when {break; unreachable} {true {unreachable}}")
          ).to.eql(BREAK());
          expect(
            execute(
              "set count 0; when {if {$count == 1} {break; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(BREAK());
        });
        it("should interrupt bodies with BREAK code", () => {
          expect(execute("when {true {break; unreachable}}")).to.eql(BREAK());
          expect(execute("when {false {} true {break; unreachable}}")).to.eql(
            BREAK()
          );
          expect(
            execute("when {false {} false {} {break; unreachable}}")
          ).to.eql(BREAK());
        });
      });
      describe("continue", () => {
        it("should interrupt tests with CONTINUE code", () => {
          expect(
            execute("when {{continue; unreachable} {unreachable}}")
          ).to.eql(CONTINUE());
          expect(
            execute("when {false {} {continue; unreachable} {unreachable}}")
          ).to.eql(CONTINUE());
        });
        it("should interrupt script command with BREAK code", () => {
          expect(
            execute("when {continue; unreachable} {true {unreachable}}")
          ).to.eql(CONTINUE());
          expect(
            execute(
              "set count 0; when {if {$count == 1} {continue; unreachable} else {set count [+ $count 1]; idem idem}} {false {unreachable} true {unreachable} {unreachable}}"
            )
          ).to.eql(CONTINUE());
        });
        it("should interrupt bodies with CONTINUE code", () => {
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
    describe("exceptions", () => {
      specify("wrong arity", () => {
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
      });
      specify("invalid case list", () => {
        expect(execute("when a")).to.eql(ERROR("invalid list"));
        expect(execute("when []")).to.eql(ERROR("invalid list"));
        expect(execute("when {$a}")).to.eql(ERROR("invalid list"));
      });
    });
  });
});
