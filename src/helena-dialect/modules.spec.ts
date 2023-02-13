import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { ListValue, NIL, StringValue } from "../core/values";
import { commandValueType, Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena modules", () => {
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

  describe("module", () => {
    it("should define a new command", () => {
      evaluate("module cmd {}");
      expect(rootScope.context.commands.has("cmd")).to.be.true;
    });
    it("should replace existing commands", () => {
      evaluate("module cmd {}");
      expect(execute("module cmd {}").code).to.eql(ResultCode.OK);
    });
    it("should return a command value", () => {
      expect(evaluate("module {}").type).to.eql(commandValueType);
      expect(evaluate("module cmd  {}").type).to.eql(commandValueType);
    });
    specify("command should return self", () => {
      const value = evaluate("module cmd {}");
      expect(evaluate("cmd")).to.eql(value);
    });
    specify("command value should return self", () => {
      const value = evaluate("set cmd [module {}]");
      expect(evaluate("$cmd")).to.eql(value);
    });
    describe("body", () => {
      it("should be executed", () => {
        expect(execute("module {macro cmd {} {error message}; cmd}")).to.eql(
          ERROR("message")
        );
      });
      it("should not access outer commands", () => {
        evaluate("closure cmd {} {unreachable}");
        expect(execute("module {cmd}")).to.eql(
          ERROR('cannot resolve command "cmd"')
        );
      });
      it("should not define outer commands", () => {
        evaluate("closure cmd {} {idem outer}");
        evaluate("module {closure cmd {} {idem outer}}");
        expect(evaluate("cmd")).to.eql(new StringValue("outer"));
      });
      it("should not access outer variables", () => {
        evaluate("set var val");
        expect(execute("module {idem $var}")).to.eql(
          ERROR('cannot resolve variable "var"')
        );
      });
      it("should not set outer variables", () => {
        evaluate("set var val");
        evaluate("module {set var val2; let cst val3}");
        expect(rootScope.context.variables.get("var")).to.eql(
          new StringValue("val")
        );
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });
      describe("control flow", () => {
        describe("return", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {return value}")).to.eql(
              ERROR("unexpected return")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {return value}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("tailcall", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {tailcall {idem value}}")).to.eql(
              ERROR("unexpected return")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {return value}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("yield", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {yield value}")).to.eql(
              ERROR("unexpected yield")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {yield value}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("error", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {error message}")).to.eql(ERROR("message"));
          });
          it("should not define the module command", () => {
            evaluate("module cmd {error message}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("break", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {break}")).to.eql(ERROR("unexpected break"));
          });
          it("should not define the module command", () => {
            evaluate("module cmd {break}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("continue", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {continue}")).to.eql(
              ERROR("unexpected continue")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {continue}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("pass", () => {
          it("should interrupt the body with ERROR code", () => {
            expect(execute("module {pass}")).to.eql(ERROR("unexpected pass"));
          });
          it("should not define the module command", () => {
            evaluate("module cmd {pass}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
      });
    });
    describe("methods", () => {
      describe("exports", () => {
        it("should return a list", () => {
          expect(evaluate("[module {}] exports")).to.eql(new ListValue([]));
        });
        it("should return the list of module exports", () => {
          expect(
            evaluate("[module {export a; export b; export c}] exports")
          ).to.eql(evaluate("list (a b c)"));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[module {}] exports a")).to.eql(
              ERROR('wrong # args: should be "module exports"')
            );
          });
        });
      });
      describe("import", () => {
        it("should declare imported commands in the calling scope", () => {
          evaluate(`module mod {macro cmd {} {idem value}; export cmd}`);
          evaluate("mod import cmd");
          expect(evaluate("cmd")).to.eql(new StringValue("value"));
        });
        it("should return nil", () => {
          evaluate(`module mod {macro cmd {} {idem value}; export cmd}`);
          expect(execute("mod import cmd")).to.eql(OK(NIL));
        });
        it("should replace existing commands", () => {
          evaluate("closure cmd {} {idem val1} ");
          expect(evaluate("cmd")).to.eql(new StringValue("val1"));
          evaluate(`module mod {macro cmd {} {idem val2}; export cmd}`);
          evaluate("mod import cmd");
          expect(evaluate("cmd")).to.eql(new StringValue("val2"));
        });
        it("should evaluate macros in the caller scope", () => {
          evaluate(`module mod {macro cmd {} {set var val}; export cmd}`);
          evaluate("mod import cmd");
          evaluate("cmd");
          expect(evaluate("get var")).to.eql(new StringValue("val"));
        });
        it("should evaluate closures in their scope", () => {
          evaluate(
            `module mod {set var val; closure cmd {} {get var}; export cmd}`
          );
          evaluate("mod import cmd");
          expect(evaluate("cmd")).to.eql(new StringValue("val"));
          expect(execute("get var").code).to.eql(ResultCode.ERROR);
        });
        it("should resolve exported commands at call time", () => {
          evaluate(`
            module mod {
              closure cmd {} {idem val1}
              export cmd
              closure redefine {} {
                closure cmd {} {idem val2}
              }
              export redefine
            }
          `);
          expect(evaluate("mod import cmd; cmd")).to.eql(
            new StringValue("val1")
          );
          evaluate("mod import redefine; redefine");
          expect(evaluate("cmd")).to.eql(new StringValue("val1"));
          expect(evaluate("mod import cmd; cmd")).to.eql(
            new StringValue("val2")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("[module {}] import")).to.eql(
              ERROR('wrong # args: should be "module import name"')
            );
            expect(execute("[module {}] import a b")).to.eql(
              ERROR('wrong # args: should be "module import name"')
            );
          });
          specify("unknown export", () => {
            expect(execute("[module {}] import a")).to.eql(
              ERROR('unknown export "a"')
            );
          });
          specify("unresolved export", () => {
            expect(execute("[module {export a}] import a")).to.eql(
              ERROR('cannot resolve export "a"')
            );
          });
          specify("import name with no string representation", () => {
            expect(execute("[module {}] import []")).to.eql(
              ERROR("import name has no string representation")
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing method", () => {
          expect(execute("[module {}] unknownMethod")).to.eql(
            ERROR('invalid method name "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("module")).to.eql(
          ERROR('wrong # args: should be "module ?name? body"')
        );
        expect(execute("module a b c")).to.eql(
          ERROR('wrong # args: should be "module ?name? body"')
        );
      });
      specify("non-script body", () => {
        expect(execute("module a")).to.eql(ERROR("body must be a script"));
        expect(execute("module a b")).to.eql(ERROR("body must be a script"));
      });
      specify("command name with no string representation", () => {
        expect(execute("module [] {}")).to.eql(
          ERROR("command name has no string representation")
        );
      });
    });
  });
  describe("export", () => {
    it("should not exist in non-module scope", () => {
      expect(execute("export")).to.eql(
        ERROR('cannot resolve command "export"')
      );
    });
    it("should exist in module scope", () => {
      expect(execute("module {export foo}").code).to.eql(ResultCode.OK);
    });
    it("should return nil", () => {
      evaluate(`
        module mod {
          set result [export cmd]
          closure cmd {} {get result}
        }
      `);
      evaluate("mod import cmd");
      expect(execute("cmd")).to.eql(OK(NIL));
    });
    it("should add command name to exports", () => {
      evaluate("module mod {macro cmd {} {}; export cmd}");
      expect(evaluate("mod exports")).to.eql(evaluate("list (cmd)"));
    });
    it("should allow non-existing names", () => {
      evaluate("module mod {export cmd}");
      expect(evaluate("mod exports")).to.eql(evaluate("list (cmd)"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("module {export}")).to.eql(
          ERROR('wrong # args: should be "export name"')
        );
        expect(execute("module {export a b}")).to.eql(
          ERROR('wrong # args: should be "export name"')
        );
      });
      specify("export name with no string representation", () => {
        expect(execute("module {export []}")).to.eql(
          ERROR("export name has no string representation")
        );
      });
    });
  });
});
