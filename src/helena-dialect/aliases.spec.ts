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
import { NIL, StringValue, TupleValue } from "../core/values";
import { CommandValue, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena aliases", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  beforeEach(() => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("alias", () => {
    it("should define a new command", () => {
      evaluate("alias cmd idem");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("alias cmd set");
      expect(execute("alias cmd idem").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("alias cmd idem")).to.be.instanceof(CommandValue);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [alias cmd set]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("calls", () => {
      it("should call the aliased command", () => {
        evaluate("macro mac {} {set var val}");
        evaluate("alias cmd mac");
        evaluate("cmd");
        expect(evaluate("get var")).to.eql(new StringValue("val"));
      });
      describe("command tuples", () => {
        specify("zero", () => {
          evaluate("alias cmd ()");
          expect(execute("cmd")).to.eql(OK(NIL));
          expect(execute("cmd idem val")).to.eql(OK(new StringValue("val")));
        });
        specify("one", () => {
          evaluate("alias cmd return");
          expect(execute("cmd")).to.eql(RETURN());
          expect(execute("cmd val")).to.eql(RETURN(new StringValue("val")));
        });
        specify("two", () => {
          evaluate("alias cmd (idem val)");
          expect(execute("cmd")).to.eql(OK(new StringValue("val")));
        });
        specify("three", () => {
          evaluate("alias cmd (set var val)");
          expect(execute("cmd")).to.eql(OK(new StringValue("val")));
          expect(evaluate("get var")).to.eql(new StringValue("val"));
        });
      });
    });
    describe("arguments", () => {
      it("should be passed to aliased commands", () => {
        evaluate("alias cmd (set var)");
        expect(execute("cmd val")).to.eql(OK(new StringValue("val")));
        expect(evaluate("get var")).to.eql(new StringValue("val"));
      });
      describe("exceptions", () => {
        specify("wrong arity", () => {
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
    describe("control flow", () => {
      describe("return", () => {
        it("should interrupt a macro alias with RETURN code", () => {
          evaluate("macro mac {} {return val1; idem val2}");
          evaluate("alias cmd mac");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
        it("should interrupt a tuple alias with RETURN code", () => {
          evaluate("alias cmd (return val)");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("tailcall", () => {
        it("should interrupt a macro alias with RETURN code", () => {
          evaluate("macro mac {} {tailcall {idem val1}; idem val2}");
          evaluate("alias cmd mac");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val1")));
        });
        it("should interrupt a tuple alias with RETURN code", () => {
          evaluate("alias cmd (tailcall {idem val})");
          expect(execute("cmd")).to.eql(RETURN(new StringValue("val")));
        });
      });
      describe("yield", () => {
        it("should interrupt a macro alias with YIELD code", () => {
          evaluate("macro mac {} {yield val1; idem val2}");
          evaluate("alias cmd mac");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
        });
        it("should interrupt a tuple alias with YIELD code", () => {
          evaluate("alias cmd (yield val1)");
          const result = execute("cmd");
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
        });
        it("should provide a resumable state for macro alias", () => {
          evaluate("macro mac {} {idem _[yield val1]_}");
          evaluate("alias cmd mac");
          const state = rootScope.prepareScript(parse("cmd"));

          let result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
          expect(result.data).to.exist;

          state.yieldBack(new StringValue("val2"));
          result = state.run();
          expect(result).to.eql(OK(new StringValue("_val2_")));
        });
        it("should provide a resumable state for tuple alias", () => {
          evaluate("alias cmd (yield val1)");
          const state = rootScope.prepareScript(parse("cmd"));

          let result = state.run();
          expect(result.code).to.eql(ResultCode.YIELD);
          expect(result.value).to.eql(new StringValue("val1"));
          expect(result.data).to.exist;

          state.yieldBack(new StringValue("val2"));
          result = state.run();
          expect(result).to.eql(OK(new StringValue("val2")));
        });
      });
      describe("error", () => {
        it("should interrupt a macro alias with ERROR code", () => {
          evaluate("macro mac {} {error msg; idem val}");
          evaluate("alias cmd mac");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
        it("should interrupt a tuple alias with ERROR code", () => {
          evaluate("alias cmd (error msg)");
          expect(execute("cmd")).to.eql(ERROR("msg"));
        });
      });
      describe("break", () => {
        it("should interrupt a macro alias with BREAK code", () => {
          evaluate("macro mac {} {break; idem val}");
          evaluate("alias cmd mac");
          expect(execute("cmd")).to.eql(BREAK());
        });
        it("should interrupt a tuple alias with BREAK code", () => {
          evaluate("alias cmd (break)");
          expect(execute("cmd")).to.eql(BREAK());
        });
      });
      describe("continue", () => {
        it("should interrupt a macro alias with CONTINUE code", () => {
          evaluate("macro mac {} {continue; idem val}");
          evaluate("alias cmd mac");
          expect(execute("cmd")).to.eql(CONTINUE());
        });
        it("should interrupt a tuple alias with CONTINUE code", () => {
          evaluate("alias cmd (continue)");
          expect(execute("cmd")).to.eql(CONTINUE());
        });
      });
    });
    describe("methods", () => {
      describe("call", () => {
        it("should call aliased command", () => {
          evaluate("set cmd [alias cmd (idem val)]");
          expect(evaluate("$cmd call")).to.eql(new StringValue("val"));
        });
        it("should pass arguments to aliased command", () => {
          evaluate("set cmd [alias cmd idem]");
          expect(evaluate("$cmd call val")).to.eql(new StringValue("val"));
        });
        it("should report the original command arity error", () => {
          evaluate("set cmd [alias cmd idem]");
          expect(execute("$cmd call")).to.eql(
            ERROR('wrong # args: should be "idem value"')
          );
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt a macro alias with RETURN code", () => {
              evaluate("macro mac {} {return val1; idem val2}");
              evaluate("set cmd [alias cmd mac]");
              expect(execute("$cmd call")).to.eql(
                RETURN(new StringValue("val1"))
              );
            });
            it("should interrupt a tuple alias with RETURN code", () => {
              evaluate("set cmd [alias cmd (return val)]");
              expect(execute("$cmd call")).to.eql(
                RETURN(new StringValue("val"))
              );
            });
          });
          describe("tailcall", () => {
            it("should interrupt a macro alias with RETURN code", () => {
              evaluate("macro mac {} {tailcall {idem val1}; idem val2}");
              evaluate("set cmd [alias cmd mac]");
              expect(execute("$cmd call")).to.eql(
                RETURN(new StringValue("val1"))
              );
            });
            it("should interrupt a tuple alias with RETURN code", () => {
              evaluate("set cmd [alias cmd (tailcall {idem val})]");
              expect(execute("$cmd call")).to.eql(
                RETURN(new StringValue("val"))
              );
            });
          });
          describe("yield", () => {
            it("should interrupt a macro alias with YIELD code", () => {
              evaluate("macro mac {} {yield val1; idem val2}");
              evaluate("set cmd [alias cmd mac]");
              const result = execute("$cmd call");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("val1"));
            });
            it("should interrupt a tuple alias with YIELD code", () => {
              evaluate("set cmd [alias cmd (yield val)]");
              const result = execute("$cmd call");
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("val"));
            });
            it("should provide a resumable state for macro alias", () => {
              evaluate("macro mac {} {idem _[yield val1]_}");
              evaluate("set cmd [alias cmd mac]");
              const state = rootScope.prepareScript(parse("$cmd call"));

              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("val1"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("val2"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("_val2_")));
            });
            it("should provide a resumable state for tuple alias", () => {
              evaluate("set cmd [alias cmd (yield val1)]");
              const state = rootScope.prepareScript(parse("$cmd call"));

              let result = state.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("val1"));
              expect(result.data).to.exist;

              state.yieldBack(new StringValue("val2"));
              result = state.run();
              expect(result).to.eql(OK(new StringValue("val2")));
            });
          });
          describe("error", () => {
            it("should interrupt a macro alias with ERROR code", () => {
              evaluate("macro mac {} {error msg; idem val}");
              evaluate("set cmd [alias cmd mac]");
              expect(execute("$cmd call")).to.eql(ERROR("msg"));
            });
            it("should interrupt a tuple alias with ERROR code", () => {
              evaluate("set cmd [alias cmd (error msg)]");
              expect(execute("$cmd call")).to.eql(ERROR("msg"));
            });
          });
          describe("break", () => {
            it("should interrupt a macro alias with BREAK code", () => {
              evaluate("macro mac {} {break; idem val}");
              evaluate("set cmd [alias cmd mac]");
              expect(execute("$cmd call")).to.eql(BREAK());
            });
            it("should interrupt a tuple alias with BREAK code", () => {
              evaluate("set cmd [alias cmd (break)]");
              expect(execute("$cmd call")).to.eql(BREAK());
            });
          });
          describe("continue", () => {
            it("should interrupt a macro alias with CONTINUE code", () => {
              evaluate("macro mac {} {continue; idem val}");
              evaluate("set cmd [alias cmd mac]");
              expect(execute("$cmd call")).to.eql(CONTINUE());
            });
            it("should interrupt a tuple alias with CONTINUE code", () => {
              evaluate("set cmd [alias cmd (continue)]");
              expect(execute("$cmd call")).to.eql(CONTINUE());
            });
          });
        });
      });
      describe("command", () => {
        it("should return the aliased command", () => {
          evaluate("set cmd [alias cmd (idem val)]");
          expect(evaluate("$cmd command")).to.eql(
            new TupleValue([new StringValue("idem"), new StringValue("val")])
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[alias cmd set] command a")).to.eql(
              ERROR('wrong # args: should be "alias command"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[alias cmd idem] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("alias a")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
        expect(execute("alias a b c")).to.eql(
          ERROR('wrong # args: should be "alias name command"')
        );
      });
    });
  });
});
