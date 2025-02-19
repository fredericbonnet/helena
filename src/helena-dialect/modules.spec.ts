import * as path from "node:path";
import * as mochadoc from "../../mochadoc";
import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import {
  CommandValue,
  LIST,
  NIL,
  STR,
  StringValue,
  ValueType,
} from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { Module, ModuleRegistry } from "./modules";
import { codeBlock, describeCommand } from "./test-helpers";
import { ErrorStack } from "../core/errors";

const asString = (value) => StringValue.toString(value)[1];

describe("Helena modules", () => {
  let rootScope: Scope;
  let moduleRegistry: ModuleRegistry;

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
    moduleRegistry = new ModuleRegistry();
    initCommands(rootScope, moduleRegistry, __dirname);

    tokenizer = new Tokenizer();
    parser = new Parser();
  };
  const usage = (script: string) => {
    init();
    return codeBlock(asString(evaluate("help " + script)));
  };

  beforeEach(init);

  mochadoc.meta({ toc: true });

  describeCommand("module", () => {
    mochadoc.summary("Create a module command");
    mochadoc.usage(usage("module"));
    mochadoc.description(() => {
      /**
       * The `module` command creates a new command that will encapsulate an
       * isolated root scope.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help module")).to.eql(STR("module ?name? body"));
        expect(evaluate("help module {}")).to.eql(STR("module ?name? body"));
        expect(evaluate("help module cmd {}")).to.eql(
          STR("module ?name? body")
        );
      });

      it("should define a new command", () => {
        evaluate("module cmd {}");
        expect(rootScope.context.commands.has("cmd")).to.be.true;
      });
      it("should replace existing commands", () => {
        evaluate("module cmd {}");
        expect(execute("module cmd {}").code).to.eql(ResultCode.OK);
      });
      it("should return a module value", () => {
        expect(evaluate("module {}").type).to.eql(ValueType.COMMAND);
        expect(evaluate("module cmd  {}").type).to.eql(ValueType.COMMAND);
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("module")).to.eql(
          ERROR('wrong # args: should be "module ?name? body"')
        );
        expect(execute("module a b c")).to.eql(
          ERROR('wrong # args: should be "module ?name? body"')
        );
        expect(execute("help module a b c")).to.eql(
          ERROR('wrong # args: should be "module ?name? body"')
        );
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("module [] {}")).to.eql(ERROR("invalid command name"));
      });
      specify("non-script body", () => {
        expect(execute("module a")).to.eql(ERROR("body must be a script"));
        expect(execute("module a b")).to.eql(ERROR("body must be a script"));
      });
    });

    mochadoc.section("`body`", () => {
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
        expect(evaluate("cmd")).to.eql(STR("outer"));
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
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
        expect(rootScope.context.constants.has("cst")).to.be.false;
      });

      describe("Control flow", () => {
        mochadoc.description(() => {
          /**
           * If the body returns a result code other than `OK` then it should be
           * propagated properly by the command.
           */
        });

        describe("`return`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {return value}")).to.eql(
              ERROR("unexpected return")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {return value}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`tailcall`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {tailcall {idem value}}")).to.eql(
              ERROR("unexpected return")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {return value}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`yield`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {yield value}")).to.eql(
              ERROR("unexpected yield")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {yield value}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`error`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {error message}")).to.eql(ERROR("message"));
          });
          it("should not define the module command", () => {
            evaluate("module cmd {error message}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`break`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {break}")).to.eql(ERROR("unexpected break"));
          });
          it("should not define the module command", () => {
            evaluate("module cmd {break}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`continue`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {continue}")).to.eql(
              ERROR("unexpected continue")
            );
          });
          it("should not define the module command", () => {
            evaluate("module cmd {continue}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
        describe("`pass`", () => {
          it("should interrupt the body with `ERROR` code", () => {
            expect(execute("module {pass}")).to.eql(ERROR("unexpected pass"));
          });
          it("should not define the module command", () => {
            evaluate("module cmd {pass}");
            expect(rootScope.context.commands.has("cmd")).to.be.false;
          });
        });
      });
    });

    mochadoc.section("Module value", () => {
      mochadoc.description(() => {
        /**
         * `module` returns a module value that can be passed around and called
         * by value instead of by name.
         */
      });
      mochadoc.usage(usage("[module {}]"));

      mochadoc.section("Specifications", () => {
        specify("usage", () => {
          evaluate("set cmd [module cmd {}]");
          expect(evaluate("help cmd")).to.eql(
            STR("cmd ?subcommand? ?arg ...?")
          );
          expect(evaluate("help $cmd")).to.eql(
            STR("<module> ?subcommand? ?arg ...?")
          );
        });
        specify("calling the module value should return itself", () => {
          const value = evaluate("set cmd [module {}]");
          expect(evaluate("$cmd")).to.eql(value);
        });
      });
    });
  });

  mochadoc.section("Module commands", () => {
    mochadoc.description(() => {
      /**
       * Module commands are commands that encapsulate an isolated root scope.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        evaluate("set cmd [module cmd {}]");
        expect(evaluate("help cmd")).to.eql(STR("cmd ?subcommand? ?arg ...?"));
        expect(evaluate("help $cmd")).to.eql(
          STR("<module> ?subcommand? ?arg ...?")
        );
      });
      it("should return its module value when called with no argument", () => {
        /**
         * The typical application of this property is to pass around or call
         * the module command by value.
         */
        const value = evaluate("scope cmd {}");
        expect(evaluate("cmd")).to.eql(value);
      });
    });

    mochadoc.section("Subcommands", () => {
      describe("`subcommands`", () => {
        mochadoc.description(usage("[module {}] subcommands"));

        it("should return list of subcommands", () => {
          /**
           * This subcommand is useful for introspection and interactive
           * calls.
           */
          expect(evaluate("[module {}] subcommands")).to.eql(
            evaluate("list (subcommands exports import)")
          );
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            evaluate("set cmd [module cmd {}]");
            expect(execute("cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "cmd subcommands"')
            );
            expect(execute("$cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "<module> subcommands"')
            );
            expect(execute("help cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "cmd subcommands"')
            );
            expect(execute("help $cmd subcommands a")).to.eql(
              ERROR('wrong # args: should be "<module> subcommands"')
            );
          });
        });
      });

      describe("`exports`", () => {
        mochadoc.description(usage("[module {}] exports"));

        it("should return a list", () => {
          expect(evaluate("[module {}] exports")).to.eql(LIST([]));
        });
        it("should return the list of module exports", () => {
          /**
           * Note that exports are returned in no special order.
           */
          expect(
            evaluate(
              "list [[module {export a; export b; export c}] exports] sort"
            )
          ).to.eql(evaluate("list (a b c) sort"));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            evaluate("set cmd [module cmd {}]");
            expect(execute("cmd exports a")).to.eql(
              ERROR('wrong # args: should be "cmd exports"')
            );
            expect(execute("$cmd exports a")).to.eql(
              ERROR('wrong # args: should be "<module> exports"')
            );
            expect(execute("help cmd exports a")).to.eql(
              ERROR('wrong # args: should be "cmd exports"')
            );
            expect(execute("help $cmd exports a")).to.eql(
              ERROR('wrong # args: should be "<module> exports"')
            );
          });
        });
      });

      describe("`import`", () => {
        mochadoc.description(usage("[module {}] import"));

        it("should declare imported commands in the calling scope", () => {
          evaluate(`module mod {macro cmd {} {idem value}; export cmd}`);
          evaluate("mod import cmd");
          expect(evaluate("cmd")).to.eql(STR("value"));
        });
        it("should return nil", () => {
          evaluate(`module mod {macro cmd {} {idem value}; export cmd}`);
          expect(execute("mod import cmd")).to.eql(OK(NIL));
        });
        it("should replace existing commands", () => {
          evaluate("closure cmd {} {idem val1} ");
          expect(evaluate("cmd")).to.eql(STR("val1"));
          evaluate(`module mod {macro cmd {} {idem val2}; export cmd}`);
          evaluate("mod import cmd");
          expect(evaluate("cmd")).to.eql(STR("val2"));
        });
        it("should evaluate macros in the caller scope", () => {
          evaluate(`module mod {macro cmd {} {set var val}; export cmd}`);
          evaluate("mod import cmd");
          evaluate("cmd");
          expect(evaluate("get var")).to.eql(STR("val"));
        });
        it("should evaluate closures in their scope", () => {
          evaluate(
            `module mod {set var val; closure cmd {} {get var}; export cmd}`
          );
          evaluate("mod import cmd");
          expect(evaluate("cmd")).to.eql(STR("val"));
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
          expect(evaluate("mod import cmd; cmd")).to.eql(STR("val1"));
          evaluate("mod import redefine; redefine");
          expect(evaluate("cmd")).to.eql(STR("val1"));
          expect(evaluate("mod import cmd; cmd")).to.eql(STR("val2"));
        });
        it("should accept an optional alias name", () => {
          evaluate("macro cmd {} {idem original}");
          evaluate(`module mod {macro cmd {} {idem imported}; export cmd}`);
          evaluate("mod import cmd cmd2");
          expect(evaluate("cmd")).to.eql(STR("original"));
          expect(evaluate("cmd2")).to.eql(STR("imported"));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The subcommand will return an error message with usage when
             * given the wrong number of arguments.
             */
            evaluate("set cmd [module cmd {}]");
            expect(execute("cmd import")).to.eql(
              ERROR('wrong # args: should be "cmd import name ?alias?"')
            );
            expect(execute("$cmd import")).to.eql(
              ERROR('wrong # args: should be "<module> import name ?alias?"')
            );
            expect(execute("cmd import a b c")).to.eql(
              ERROR('wrong # args: should be "cmd import name ?alias?"')
            );
            expect(execute("$cmd import a b c")).to.eql(
              ERROR('wrong # args: should be "<module> import name ?alias?"')
            );
            expect(execute("help cmd import a b c")).to.eql(
              ERROR('wrong # args: should be "cmd import name ?alias?"')
            );
            expect(execute("help $cmd import a b c")).to.eql(
              ERROR('wrong # args: should be "<module> import name ?alias?"')
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
          specify("invalid import name", () => {
            expect(execute("[module {}] import []")).to.eql(
              ERROR("invalid import name")
            );
          });
          specify("invalid alias name", () => {
            expect(execute("[module {}] import a []")).to.eql(
              ERROR("invalid alias name")
            );
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("[module {}] unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("[module {}] []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });
  });

  describeCommand("export", () => {
    mochadoc.summary("Export a command from the current module");
    mochadoc.usage(
      (() => {
        init();
        const usage = evaluate(`
          [module {
            closure usage {} {help export}
            export usage
          }] import usage
          usage
        `);
        return codeBlock((usage as StringValue).value);
      })()
    );
    mochadoc.description(() => {
      /**
       * The `export` command exports a command from the current module by
       * making it available for other modules through its `import` subcommand.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        evaluate(`
          [module {
            closure usage {*args} {help $*args}
            export usage
          }] import usage
        `);
        expect(evaluate("usage export")).to.eql(STR("export name"));
        expect(evaluate("usage export cmd")).to.eql(STR("export name"));
      });

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
      it("should allow non-existing command names", () => {
        evaluate("module mod {export cmd}");
        expect(evaluate("mod exports")).to.eql(evaluate("list (cmd)"));
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("module {export}")).to.eql(
          ERROR('wrong # args: should be "export name"')
        );
        expect(execute("module {export a b}")).to.eql(
          ERROR('wrong # args: should be "export name"')
        );
        expect(execute("module {help export a b}")).to.eql(
          ERROR('wrong # args: should be "export name"')
        );
      });
      specify("invalid `name`", () => {
        /**
         * Command names must have a valid string representation.
         */
        expect(execute("module {export []}")).to.eql(
          ERROR("invalid export name")
        );
      });
    });
  });

  describeCommand("import", () => {
    const moduleAPathRel = "tests/module-a.lna";
    const moduleAPathAbs = `"""${path.join(__dirname, moduleAPathRel)}"""`;
    const moduleBPath = `"tests/module-b.lna"`;
    const moduleCPath = `"tests/module-c.lna"`;
    const moduleDPath = `"tests/module-d.lna"`;
    const errorPath = `"tests/error.txt"`;

    mochadoc.summary("Load a module");
    mochadoc.usage(usage("import"));
    mochadoc.description(() => {
      /**
       * The `import` command loads a module from the file system. On first
       * load, the file content is evaluated as a script in a new module scope,
       * and the module is added to a global registry.
       */
    });

    mochadoc.section("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help import")).to.eql(
          STR("import path ?name|imports?")
        );
        expect(evaluate("help import /a")).to.eql(
          STR("import path ?name|imports?")
        );
        expect(evaluate("help import /a b")).to.eql(
          STR("import path ?name|imports?")
        );
      });

      it("should return a module value", () => {
        const value = evaluate(`set cmd [import ${moduleAPathAbs}]`);
        expect(value.type).to.eql(ValueType.COMMAND);
        expect(evaluate("$cmd exports")).to.eql(LIST([STR("name")]));
      });
      specify(
        "relative paths should resolve relatively to the working directory",
        () => {
          evaluate(`import ${moduleAPathRel} (name)`);
          expect(evaluate("name")).to.eql(STR("module-a"));
        }
      );
      specify(
        "in-module relative paths should resolve relatively to the module path",
        () => {
          evaluate(`import ${moduleCPath} (name)`);
          expect(evaluate("name")).to.eql(STR("module-a"));
        }
      );
      specify("multiple imports should resolve to the same object", () => {
        const value = evaluate(`import ${moduleAPathAbs}`);
        expect(evaluate(`import ${moduleAPathAbs}`)).to.equal(value);
        expect(evaluate(`import ${moduleAPathRel}`)).to.equal(value);
      });
      it("should not support circular imports", () => {
        expect(execute(`import ${moduleDPath}`)).to.eql(
          ERROR("circular imports are forbidden")
        );
      });
      it("should support named modules", () => {
        const foo = evaluate(
          'module {macro name {} {idem "foo module"}; export name}'
        );
        expect(foo.type).to.eql(ValueType.COMMAND);
        moduleRegistry.register("foo", (foo as CommandValue).command as Module);
        expect(evaluate("import foo")).to.eql(foo);
        expect(evaluate("import foo (name); name")).to.eql(STR("foo module"));
      });

      describe("`name`", () => {
        it("should define a new command", () => {
          evaluate(`import ${moduleAPathRel} cmd`);
          expect(rootScope.context.commands.has("cmd")).to.be.true;
        });
        it("should replace existing commands", () => {
          evaluate("macro cmd {}");
          expect(execute(`import ${moduleAPathRel} cmd`).code).to.eql(
            ResultCode.OK
          );
        });
        specify("the named command should return its command object", () => {
          const value = evaluate(`import ${moduleAPathRel} cmd`);
          expect(evaluate("cmd")).to.eql(value);
        });
      });

      describe("`imports`", () => {
        it("should declare imported commands in the calling scope", () => {
          evaluate(`import ${moduleAPathRel} (name)`);
          expect(evaluate("name")).to.eql(STR("module-a"));
        });
        it("should accept tuples", () => {
          evaluate(`import ${moduleAPathRel} (name)`);
          expect(evaluate("name")).to.eql(STR("module-a"));
        });
        it("should accept lists", () => {
          evaluate(`import ${moduleAPathRel} [list (name)]`);
          expect(evaluate("name")).to.eql(STR("module-a"));
        });
        it("should accept blocks", () => {
          evaluate(`import ${moduleAPathRel} {name}`);
          expect(evaluate("name")).to.eql(STR("module-a"));
        });
        it("should accept (name alias) tuples", () => {
          evaluate("macro name {} {idem original}");
          evaluate(`import ${moduleAPathRel} ( (name name2) )`);
          expect(evaluate("name")).to.eql(STR("original"));
          expect(evaluate("name2")).to.eql(STR("module-a"));
        });

        describe("Exceptions", () => {
          specify("unknown export", () => {
            expect(execute(`import ${moduleAPathRel} (a)`)).to.eql(
              ERROR('unknown export "a"')
            );
          });
          specify("unresolved export", () => {
            expect(execute(`import ${moduleBPath} (unresolved)`)).to.eql(
              ERROR('cannot resolve export "unresolved"')
            );
          });
          specify("invalid import name", () => {
            expect(execute(`import ${moduleBPath} ([])`)).to.eql(
              ERROR("invalid import name")
            );
            expect(execute(`import ${moduleBPath} ( ([] a) )`)).to.eql(
              ERROR("invalid import name")
            );
          });
          specify("invalid alias name", () => {
            expect(execute(`import ${moduleBPath} ( (name []) )`)).to.eql(
              ERROR("invalid alias name")
            );
          });
          specify("invalid name tuple", () => {
            expect(execute(`import ${moduleBPath} ( () )`)).to.eql(
              ERROR("invalid (name alias) tuple")
            );
            expect(execute(`import ${moduleBPath} ( (a b c) )`)).to.eql(
              ERROR("invalid (name alias) tuple")
            );
          });
        });
      });
    });

    mochadoc.section("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("import")).to.eql(
          ERROR('wrong # args: should be "import path ?name|imports?"')
        );
        expect(execute("import a b c")).to.eql(
          ERROR('wrong # args: should be "import path ?name|imports?"')
        );
        expect(execute("help import a b c")).to.eql(
          ERROR('wrong # args: should be "import path ?name|imports?"')
        );
      });
      specify("invalid path", () => {
        expect(execute(`import []`)).to.eql(ERROR("invalid path"));
      });
      specify("unknown file", () => {
        const result = execute(`import /unknownFile`);
        expect(result.code).to.eql(ResultCode.ERROR);
        expect(asString(result.value)).to.include("error reading module");
      });
      specify("invalid file", () => {
        const result = execute(`import /`);
        expect(result.code).to.eql(ResultCode.ERROR);
        expect(asString(result.value)).to.include("error reading module");
      });
      specify("parsing error", () => {
        expect(execute(`import ${errorPath}`)).to.eql(
          ERROR("unmatched left brace")
        );
      });
    });
  });

  mochadoc.section("Error stacks", () => {
    beforeEach(() => {
      parser = new Parser({ capturePositions: true });
      rootScope = Scope.newRootScope({
        capturePositions: true,
        captureErrorStack: true,
      });
      moduleRegistry = new ModuleRegistry({
        capturePositions: true,
        captureErrorStack: true,
      });
      initCommands(rootScope, moduleRegistry, __dirname);
    });
    specify("module", () => {
      const source = `
module {
  macro cmd {} {error msg}
  cmd
}
`;
      const process = prepareScript(source);
      const result = process.run();
      expect(result.code).to.eql(ResultCode.ERROR);
      expect(result.value).to.eql(STR("msg"));
      const errorStack = result.data as ErrorStack;
      expect(errorStack.depth()).to.eql(3);
      expect(errorStack.level(0)).to.eql({
        frame: [STR("error"), STR("msg")],
        position: { index: 26, line: 2, column: 16 },
      });
      expect(errorStack.level(1)).to.eql({
        frame: [STR("cmd")],
        position: { index: 39, line: 3, column: 2 },
      });
      expect(errorStack.level(2).frame[0]).to.eql(STR("module"));
      expect(errorStack.level(2).position).to.eql({
        index: 1,
        line: 1,
        column: 0,
      });
    });
    specify("import", () => {
      const source = `import tests/error.lna`;
      const process = prepareScript(source);
      const result = process.run();
      expect(result.code).to.eql(ResultCode.ERROR);
      expect(result.value).to.eql(STR("msg"));
      const errorStack = result.data as ErrorStack;
      expect(errorStack.depth()).to.eql(2);
      expect(errorStack.level(1)).to.eql({
        frame: [STR("import"), STR("tests/error.lna")],
        position: { index: 0, line: 0, column: 0 },
      });
    });
    specify("parsing error", () => {
      const result = execute(`import tests/error.txt`);
      expect(result.code).to.eql(ResultCode.ERROR);
      expect(result.value).to.eql(STR("unmatched left brace"));
      const errorStack = result.data as ErrorStack;
      expect(errorStack.depth()).to.eql(1);
      expect(errorStack.level(0)).to.eql({
        frame: [STR("import"), STR("tests/error.txt")],
        position: { index: 0, line: 0, column: 0 },
      });
    });
  });
});
