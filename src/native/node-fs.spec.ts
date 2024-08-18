import { expect } from "chai";
import * as fs from "node:fs";
import { Command } from "../core/commands";
import { Compiler, Executor } from "../core/compiler";
import { CommandResolver, VariableResolver } from "../core/resolvers";
import { Parser } from "../core/parser";
import { ERROR, OK, ResultCode } from "../core/results";
import { Script } from "../core/syntax";
import { Tokenizer } from "../core/tokenizer";
import { DICT, NIL, STR, StringValue, Value } from "../core/values";
import { CallbackContext, fsCmd } from "./node-fs";

const asString = (value) => StringValue.toString(value)[1];

class MockVariableResolver implements VariableResolver {
  resolve(name: string): Value {
    return this.variables.get(name);
  }

  variables: Map<string, Value> = new Map();
  register(name: string, value: Value) {
    this.variables.set(name, value);
  }
}
class MockCommandResolver implements CommandResolver {
  resolve(name: Value): Command {
    return this.commands.get(asString(name));
  }

  commands: Map<string, Command> = new Map();
  register(name: string, command: Command) {
    this.commands.set(name, command);
  }
}

describe("Node.js node:fs", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let variableResolver: MockVariableResolver;
  let commandResolver: MockCommandResolver;
  let compiler: Compiler;
  let executor: Executor;

  const parse = (script: string) =>
    parser.parseTokens(tokenizer.tokenize(script)).script;
  const compile = (script: Script) => compiler.compileScript(script);
  const execute = (script: string) => executor.execute(compile(parse(script)));
  const evaluate = (script: string) => execute(script).value;

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    compiler = new Compiler();
    variableResolver = new MockVariableResolver();
    commandResolver = new MockCommandResolver();
    const callbackContext: CallbackContext = {
      callback: (args) => {
        return commandResolver.resolve(args[0])?.execute(args);
      },
    };
    executor = new Executor(
      variableResolver,
      commandResolver,
      null,
      callbackContext
    );
  });

  describe("node:fs", () => {
    beforeEach(() => {
      commandResolver.register("node:fs", fsCmd);
    });
    describe("methods", () => {
      describe("readFile", () => {
        specify("current file", (done) => {
          const output = fs.readFileSync(__filename);
          variableResolver.register("path", STR(__filename));
          commandResolver.register("callback", {
            execute: (args: Value[]) => {
              expect(args[1]).to.eql(NIL);
              expect(args[2]).to.eql(STR(output));
              done();
              return OK(NIL);
            },
          });
          expect(evaluate("node:fs readFile $path callback")).to.eql(NIL);
        });
        specify("encoding", (done) => {
          const output = fs.readFileSync(__filename, { encoding: "binary" });
          variableResolver.register("path", STR(__filename));
          variableResolver.register(
            "options",
            DICT({ encoding: STR("binary") })
          );
          commandResolver.register("callback", {
            execute: (args: Value[]) => {
              expect(args[1]).to.eql(NIL);
              expect(args[2]).to.eql(STR(output));
              done();
              return OK(NIL);
            },
          });
          expect(evaluate("node:fs readFile $path $options callback")).to.eql(
            NIL
          );
        });
        specify("error", () => {
          expect(execute("node:fs readFile ThisFileDoesNotExist").code).to.eql(
            ResultCode.ERROR
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("node:fs readFile a")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs readFile path ?options? callback"'
              )
            );
            expect(execute("node:fs readFile a b c d")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs readFile path ?options? callback"'
              )
            );
          });
          specify("invalid path value", () => {
            expect(execute("node:fs readFile [] callback")).to.eql(
              ERROR("invalid path value")
            );
          });
          specify("invalid options value", () => {
            expect(execute("node:fs readFile path [] callback")).to.eql(
              ERROR("options must be a map")
            );
          });
        });
      });
      describe("readFileSync", () => {
        specify("current file", () => {
          const output = fs.readFileSync(__filename);
          variableResolver.register("path", STR(__filename));
          expect(evaluate("node:fs readFileSync $path")).to.eql(STR(output));
        });
        specify("encoding", () => {
          const output = fs.readFileSync(__filename, { encoding: "binary" });
          variableResolver.register("path", STR(__filename));
          variableResolver.register(
            "options",
            DICT({ encoding: STR("binary") })
          );
          expect(evaluate("node:fs readFileSync $path $options")).to.eql(
            STR(output)
          );
        });
        specify("error", () => {
          expect(
            execute("node:fs readFileSync ThisFileDoesNotExist").code
          ).to.eql(ResultCode.ERROR);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("node:fs readFileSync")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs readFileSync path ?options?"'
              )
            );
            expect(execute("node:fs readFileSync a b c")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs readFileSync path ?options?"'
              )
            );
          });
          specify("invalid path value", () => {
            expect(execute("node:fs readFileSync []")).to.eql(
              ERROR("invalid path value")
            );
          });
          specify("invalid options value", () => {
            expect(execute("node:fs readFileSync path []")).to.eql(
              ERROR("options must be a map")
            );
          });
        });
      });
      describe("writeFile", () => {
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("node:fs writeFile a callback")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs writeFile file data ?options? callback"'
              )
            );
            expect(execute("node:fs writeFile a b c d e")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs writeFile file data ?options? callback"'
              )
            );
          });
          specify("invalid file value", () => {
            expect(execute("node:fs writeFile [] a callback")).to.eql(
              ERROR("invalid path value")
            );
          });
          specify("invalid data value", () => {
            expect(execute("node:fs writeFile a [] callback")).to.eql(
              ERROR("invalid data value")
            );
          });
          specify("invalid options value", () => {
            expect(execute("node:fs writeFile a b [] callback")).to.eql(
              ERROR("options must be a map")
            );
          });
        });
      });
      describe("writeFileSync", () => {
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("node:fs writeFileSync a")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs writeFileSync file data ?options?"'
              )
            );
            expect(execute("node:fs writeFileSync a b c d")).to.eql(
              ERROR(
                'wrong # args: should be "node:fs writeFileSync file data ?options?"'
              )
            );
          });
          specify("invalid file value", () => {
            expect(execute("node:fs writeFileSync [] a")).to.eql(
              ERROR("invalid path value")
            );
          });
          specify("invalid data value", () => {
            expect(execute("node:fs writeFileSync a []")).to.eql(
              ERROR("invalid data value")
            );
          });
          specify("invalid options value", () => {
            expect(execute("node:fs writeFileSync a b []")).to.eql(
              ERROR("options must be a map")
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("unknown method", () => {
          expect(execute("node:fs unknownMethod")).to.eql(
            ERROR('unknown method "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("node:fs")).to.eql(
          ERROR('wrong # args: should be "node:fs method ?arg ...?"')
        );
      });
    });
  });
});
