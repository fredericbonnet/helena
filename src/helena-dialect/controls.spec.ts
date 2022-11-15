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
      expect(execute("while false {error}").code).to.eql(ResultCode.OK);
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
          expect(execute("while {return val; error} {error}")).to.eql(
            RETURN(new StringValue("val"))
          );
        });
        it("should interrupt the loop with RETURN code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; return val; error}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("tailcall", () => {
        it("should interrupt the test with RETURN code", () => {
          expect(execute("while {tailcall {idem val}; error} {error}")).to.eql(
            RETURN(new StringValue("val"))
          );
        });
        it("should interrupt the loop with RETURN code", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; tailcall {idem val}; error}"
            )
          ).to.eql(RETURN(new StringValue("val")));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("yield", () => {
        it("should interrupt the test with YIELD code", () => {
          expect(execute("while {yield; error} {}").code).to.eql(
            ResultCode.YIELD
          );
        });
        it("should interrupt the body with YIELD code", () => {
          expect(execute("while {true} {yield; error}").code).to.eql(
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
          expect(execute("while {error msg; set var val} {error}")).to.eql(
            ERROR("msg")
          );
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
          expect(execute("while {break; error} {error}")).to.eql(BREAK());
        });
        it("should interrupt the body with nil result", () => {
          expect(
            execute("set i 0; while {$i < 10} {set i [+ $i 1]; break; error}")
          ).to.eql(OK(NIL));
          expect(evaluate("get i")).to.eql(new IntegerValue(1));
        });
      });
      describe("continue", () => {
        it("should interrupt the test with CONTINUE code", () => {
          expect(execute("while {continue; error} {error}")).to.eql(CONTINUE());
        });
        it("should interrupt the body iteration", () => {
          expect(
            execute(
              "set i 0; while {$i < 10} {set i [+ $i 1]; continue; error}"
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
      expect(evaluate("if false {error}")).to.eql(NIL);
      expect(evaluate("if false {error} elseif false {error}")).to.eql(NIL);
      expect(
        evaluate("if false {error} elseif false {error} elseif false {error}")
      ).to.eql(NIL);
    });
    it("should skip trailing tests and bodies", () => {
      expect(evaluate("if true {1} else {error}")).to.eql(new IntegerValue(1));
      expect(evaluate("if true {1} elseif {error} {error}")).to.eql(
        new IntegerValue(1)
      );
      expect(
        evaluate("if true {1} elseif {error} {error} else {error}")
      ).to.eql(new IntegerValue(1));
      expect(
        evaluate("if false {1} elseif true {2} elseif {error} {error}")
      ).to.eql(new IntegerValue(2));
    });
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt tests with RETURN code", () => {
          expect(execute("if {return val; error} {error}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute("if false {} elseif {return val; error} {error}")
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt bodies with RETURN code", () => {
          expect(execute("if true {return val; error}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(execute("if false {} elseif true {return val; error}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute("if false {} elseif false {} else {return val; error}")
          ).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt tests with RETURN code", () => {
          expect(execute("if {tailcall {idem val}; error} {error}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute("if false {} elseif {tailcall {idem val}; error} {error}")
          ).to.eql(RETURN(new StringValue("val")));
        });
        it("should interrupt bodies with RETURN code", () => {
          expect(execute("if true {tailcall {idem val}; error}")).to.eql(
            RETURN(new StringValue("val"))
          );
          expect(
            execute("if false {} elseif true {tailcall {idem val}; error}")
          ).to.eql(RETURN(new StringValue("val")));
          expect(
            execute(
              "if false {} elseif false {} else {tailcall {idem val}; error}"
            )
          ).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("yield", () => {
        it("should interrupt tests with YIELD code", () => {
          it("should interrupt tests with ERROR code", () => {
            expect(execute("if {yield; error} {error}").code).to.eql(
              ResultCode.YIELD
            );
            expect(
              execute("if false {} elseif {yield; error} {error}").code
            ).to.eql(ResultCode.YIELD);
          });
        });
        it("should interrupt bodies with YIELD code", () => {
          expect(execute("if true {yield; error}").code).to.eql(
            ResultCode.YIELD
          );
          expect(execute("if false {} elseif true {yield; error}").code).to.eql(
            ResultCode.YIELD
          );
          expect(
            execute("if false {} elseif false {} else {yield; error}").code
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
          expect(execute("if {error msg; error} {error}")).to.eql(ERROR("msg"));
          expect(
            execute("if false {} elseif {error msg; error} {error}")
          ).to.eql(ERROR("msg"));
        });
        it("should interrupt bodies with ERROR code", () => {
          expect(execute("if true {error msg; error}")).to.eql(ERROR("msg"));
          expect(execute("if false {} elseif true {error msg; error}")).to.eql(
            ERROR("msg")
          );
          expect(
            execute("if false {} elseif false {} else {error msg; error}")
          ).to.eql(ERROR("msg"));
        });
      });
      describe("break", () => {
        it("should interrupt tests with BREAK code", () => {
          expect(execute("if {break; error} {error}")).to.eql(BREAK());
          expect(execute("if false {} elseif {break; error} {error}")).to.eql(
            BREAK()
          );
        });
        it("should interrupt bodies with BREAK code", () => {
          expect(execute("if true {break; error}")).to.eql(BREAK());
          expect(execute("if false {} elseif true {break; error}")).to.eql(
            BREAK()
          );
          expect(
            execute("if false {} elseif false {} else {break; error}")
          ).to.eql(BREAK());
        });
      });
      describe("continue", () => {
        it("should interrupt tests with CONTINUE code", () => {
          expect(execute("if {continue; error} {error}")).to.eql(CONTINUE());
          expect(
            execute("if false {} elseif {continue; error} {error}")
          ).to.eql(CONTINUE());
        });
        it("should interrupt bodies with CONTINUE code", () => {
          expect(execute("if true {continue; error}")).to.eql(CONTINUE());
          expect(execute("if false {} elseif true {continue; error}")).to.eql(
            CONTINUE()
          );
          expect(
            execute("if false {} elseif false {} else {continue; error}")
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
});
