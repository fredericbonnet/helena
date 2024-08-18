import { expect } from "chai";
import * as child_process from "node:child_process";
import { Command } from "../core/commands";
import { Compiler, Executor } from "../core/compiler";
import { CommandResolver, VariableResolver } from "../core/resolvers";
import { Parser } from "../core/parser";
import { ERROR, ResultCode } from "../core/results";
import { Script } from "../core/syntax";
import { Tokenizer } from "../core/tokenizer";
import { STR, StringValue, Value } from "../core/values";
import { childProcessCmd } from "./node-child_process";

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

describe("Node.js node:child_process", () => {
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
    executor = new Executor(variableResolver, commandResolver, null);
  });

  describe("node:child_process", () => {
    beforeEach(() => {
      commandResolver.register("node:child_process", childProcessCmd);
    });
    describe("methods", () => {
      describe("execSync", () => {
        specify("node --version", () => {
          const output = child_process.execSync("node --version", {
            encoding: "utf-8",
          });
          expect(
            evaluate('node:child_process execSync "node --version"')
          ).to.eql(STR(output));
        });
        specify("error", () => {
          expect(
            execute("node:child_process execSync ThisCommandDoesNotExist").code
          ).to.eql(ResultCode.ERROR);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("node:child_process execSync")).to.eql(
              ERROR(
                'wrong # args: should be "node:child_process execSync command ?options?"'
              )
            );
            expect(execute("node:child_process execSync a b c")).to.eql(
              ERROR(
                'wrong # args: should be "node:child_process execSync command ?options?"'
              )
            );
          });
          specify("invalid command name", () => {
            expect(execute("node:child_process execSync []")).to.eql(
              ERROR("invalid command name")
            );
          });
          specify("invalid options value", () => {
            expect(execute("node:child_process execSync command []")).to.eql(
              ERROR("options must be a map")
            );
          });
        });
      });
      describe("execFileSync", () => {
        specify("node --version", () => {
          const output = child_process.execFileSync("node", ["--version"], {
            encoding: "utf-8",
          });
          expect(
            evaluate("node:child_process execFileSync node (--version)")
          ).to.eql(STR(output));
        });
        specify("error", () => {
          expect(
            execute("node:child_process execFileSync ThisCommandDoesNotExist")
              .code
          ).to.eql(ResultCode.ERROR);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("node:child_process execFileSync")).to.eql(
              ERROR(
                'wrong # args: should be "node:child_process execFileSync file ?args? ?options?"'
              )
            );
            expect(execute("node:child_process execFileSync a b c d")).to.eql(
              ERROR(
                'wrong # args: should be "node:child_process execFileSync file ?args? ?options?"'
              )
            );
          });
          specify("invalid file name", () => {
            expect(execute("node:child_process execFileSync []")).to.eql(
              ERROR("invalid file name")
            );
          });
          specify("invalid args value", () => {
            expect(
              execute("node:child_process execFileSync command []")
            ).to.eql(ERROR("args must be a tuple"));
          });
          specify("invalid options value", () => {
            expect(
              execute("node:child_process execFileSync command () []")
            ).to.eql(ERROR("options must be a map"));
          });
        });
      });
      describe("exceptions", () => {
        specify("unknown method", () => {
          expect(execute("node:child_process unknownMethod")).to.eql(
            ERROR('unknown method "unknownMethod"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("node:child_process")).to.eql(
          ERROR('wrong # args: should be "node:child_process method ?arg ...?"')
        );
      });
    });
  });
});
