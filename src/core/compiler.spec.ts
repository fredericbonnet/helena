import { expect } from "chai";
import { Result, OK, YIELD, BREAK, ERROR } from "./results";
import { Command } from "./command";
import { Compiler, OpCode, Executor, Program, ProgramState } from "./compiler";
import {
  VariableResolver,
  CommandResolver,
  SelectorResolver,
} from "./resolvers";
import { Parser } from "./parser";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";
import { BlockMorpheme, Script, Word } from "./syntax";
import { Tokenizer } from "./tokenizer";
import {
  INT,
  IntegerValue,
  LIST,
  ListValue,
  DICT,
  NIL,
  QualifiedValue,
  ScriptValue,
  STR,
  TUPLE,
  Value,
  ValueType,
} from "./values";

class MockVariableResolver implements VariableResolver {
  resolve(name: string): Value {
    return this.variables.get(name);
  }

  variables: Map<string, Value> = new Map();
  register(name: string, value: Value) {
    this.variables.set(name, value);
  }
}

class IntCommand implements Command {
  execute(args: Value[]): Result {
    return OK(args[0]);
  }
}
const INT_CMD = new IntCommand();
class MockCommandResolver implements CommandResolver {
  resolve(name: Value): Command {
    if (name.type == ValueType.INTEGER || !isNaN(parseInt(name.asString?.())))
      return INT_CMD;
    return this.commands.get(name.asString?.());
  }

  commands: Map<string, Command> = new Map();
  register(name: string, command: Command) {
    this.commands.set(name, command);
  }
}
class FunctionCommand implements Command {
  fn: (args: Value[]) => Value;
  constructor(fn: (args: Value[]) => Value) {
    this.fn = fn;
  }

  execute(args: Value[]): Result {
    return OK(this.fn(args));
  }
}

class MockSelectorResolver implements SelectorResolver {
  resolve(rules: Value[]): Selector {
    return this.builder(rules);
  }
  builder: (rules) => Selector;
  register(builder: (rules) => Selector) {
    this.builder = builder;
  }
}

describe("Compilation and execution", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let variableResolver: MockVariableResolver;
  let commandResolver: MockCommandResolver;
  let selectorResolver: MockSelectorResolver;
  let compiler: Compiler;
  let executor: Executor;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const compileFirstWord = (script: Script) => {
    const word = script.sentences[0].words[0];
    if (word instanceof Word) {
      return compiler.compileWord(word);
    } else {
      return compiler.compileConstant(word);
    }
  };

  const executionModes = [
    {
      label: "with Executor.execute()",
      execute: (program: Program) => executor.execute(program),
    },
    {
      label: "with Executor.functionify()",
      execute: (program: Program) => executor.functionify(program)(),
    },
  ];

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    compiler = new Compiler();
    variableResolver = new MockVariableResolver();
    commandResolver = new MockCommandResolver();
    selectorResolver = new MockSelectorResolver();
    executor = new Executor(
      variableResolver,
      commandResolver,
      selectorResolver
    );
  });

  for (const { label, execute } of executionModes) {
    const evaluate = (program: Program) => execute(program).value;
    describe(label, () => {
      describe("Compiler", () => {
        describe("words", () => {
          describe("roots", () => {
            specify("literal", () => {
              const script = parse("word");
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
              expect(program.constants).to.eql([STR("word")]);

              expect(evaluate(program)).to.eql(STR("word"));
            });

            describe("tuples", () => {
              specify("empty tuple", () => {
                const script = parse("()");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.CLOSE_FRAME,
                ]);

                expect(evaluate(program)).to.eql(TUPLE([]));
              });
              specify("tuple with literals", () => {
                const script = parse("( lit1 lit2 )");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                ]);
                expect(program.constants).to.eql([STR("lit1"), STR("lit2")]);

                expect(evaluate(program)).to.eql(
                  TUPLE([STR("lit1"), STR("lit2")])
                );
              });
              specify("complex case", () => {
                const script = parse(
                  '( this [cmd] $var1 "complex" ${var2}(key) )'
                );
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.JOIN_STRINGS,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.CLOSE_FRAME,
                ]);
                expect(program.constants).to.eql([
                  STR("this"),
                  STR("cmd"),
                  STR("var1"),
                  STR("complex"),
                  STR("var2"),
                  STR("key"),
                ]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("is"))
                );
                variableResolver.register("var1", STR("a"));
                variableResolver.register("var2", DICT({ key: STR("tuple") }));
                expect(evaluate(program)).to.eql(
                  TUPLE([
                    STR("this"),
                    STR("is"),
                    STR("a"),
                    STR("complex"),
                    STR("tuple"),
                  ])
                );
              });
            });

            describe("blocks", () => {
              specify("empty block", () => {
                const source = "";
                const script = parse(`{${source}}`);
                const value = new ScriptValue(parse(source), source);
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
                expect(program.constants).to.eql([value]);

                expect(evaluate(program)).to.eql(value);
              });
              specify("block with literals", () => {
                const source = " lit1 lit2 ";
                const script = parse(`{${source}}`);
                const value = new ScriptValue(parse(source), source);
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
                expect(program.constants).to.eql([value]);

                expect(evaluate(program)).to.eql(value);
              });
              specify("complex case", () => {
                const source = ' this [cmd] $var1 "complex" ${var2}(key) ';
                const script = parse(`{${source}}`);
                const block = (script.sentences[0].words[0] as Word)
                  .morphemes[0] as BlockMorpheme;
                const value = new ScriptValue(block.subscript, source);
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
                expect(program.constants).to.eql([value]);

                expect(evaluate(program)).to.eql(value);
              });
            });

            describe("expressions", () => {
              specify("empty expression", () => {
                const script = parse("[]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([OpCode.PUSH_NIL]);

                expect(evaluate(program)).to.eql(NIL);
              });
              specify("expression with literals", () => {
                const script = parse("[ cmd arg ]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                ]);
                expect(program.constants).to.eql([STR("cmd"), STR("arg")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand((args) => TUPLE([...args, STR("foo")]))
                );
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("cmd"), STR("arg"), STR("foo")])
                );
              });
              specify("complex case", () => {
                const script = parse(
                  '[ this [cmd] $var1 "complex" ${var2}(key) ]'
                );
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.JOIN_STRINGS,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                ]);
                expect(program.constants).to.eql([
                  STR("this"),
                  STR("cmd"),
                  STR("var1"),
                  STR("complex"),
                  STR("var2"),
                  STR("key"),
                ]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("is"))
                );
                variableResolver.register("var1", STR("a"));
                variableResolver.register(
                  "var2",
                  DICT({ key: STR("expression") })
                );
                commandResolver.register(
                  "this",
                  new FunctionCommand((args) => TUPLE(args))
                );
                expect(evaluate(program)).to.eql(
                  TUPLE([
                    STR("this"),
                    STR("is"),
                    STR("a"),
                    STR("complex"),
                    STR("expression"),
                  ])
                );
              });
            });

            describe("strings", () => {
              specify("empty string", () => {
                const script = parse('""');
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.JOIN_STRINGS,
                ]);

                expect(evaluate(program)).to.eql(STR(""));
              });
              specify("simple string", () => {
                const script = parse('"this is a string"');
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.JOIN_STRINGS,
                ]);
                expect(program.constants).to.eql([STR("this is a string")]);

                expect(evaluate(program)).to.eql(STR("this is a string"));
              });

              describe("expressions", () => {
                specify("simple command", () => {
                  const script = parse('"this [cmd] a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("cmd"),
                    STR(" a string"),
                  ]);

                  commandResolver.register(
                    "cmd",
                    new FunctionCommand(() => STR("is"))
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("multiple commands", () => {
                  const script = parse('"this [cmd1][cmd2] a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("cmd1"),
                    STR("cmd2"),
                    STR(" a string"),
                  ]);

                  commandResolver.register(
                    "cmd1",
                    new FunctionCommand(() => STR("i"))
                  );
                  commandResolver.register(
                    "cmd2",
                    new FunctionCommand(() => STR("s"))
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
              });

              describe("substitutions", () => {
                describe("scalars", () => {
                  specify("simple substitution", () => {
                    const script = parse('"this $var a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("var"),
                      STR(" a string"),
                    ]);

                    variableResolver.register("var", STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                  specify("double substitution", () => {
                    const script = parse('"this $$var1 a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("var1"),
                      STR(" a string"),
                    ]);

                    variableResolver.register("var1", STR("var2"));
                    variableResolver.register("var2", STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                  specify("triple substitution", () => {
                    const script = parse('"this $$$var1 a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.RESOLVE_VALUE,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("var1"),
                      STR(" a string"),
                    ]);

                    variableResolver.register("var1", STR("var2"));
                    variableResolver.register("var2", STR("var3"));
                    variableResolver.register("var3", STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                });

                describe("blocks", () => {
                  specify("varname with spaces", () => {
                    const script = parse('"this ${variable name} a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("variable name"),
                      STR(" a string"),
                    ]);

                    variableResolver.register("variable name", STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                  specify("varname with special characters", () => {
                    const script = parse(
                      '"this ${variable " " name} a string"'
                    );
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR('variable " " name'),
                      STR(" a string"),
                    ]);

                    variableResolver.register('variable " " name', STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                  specify("double substitution", () => {
                    const script = parse('"this $${variable name} a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("variable name"),
                      STR(" a string"),
                    ]);

                    variableResolver.register("variable name", STR("var2"));
                    variableResolver.register("var2", STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                });

                describe("expressions", () => {
                  specify("simple substitution", () => {
                    const script = parse('"this $[cmd] a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.EVALUATE_SENTENCE,
                      OpCode.PUSH_RESULT,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("cmd"),
                      STR(" a string"),
                    ]);

                    commandResolver.register(
                      "cmd",
                      new FunctionCommand(() => STR("is"))
                    );
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                  specify("double substitution", () => {
                    const script = parse('"this $$[cmd] a string"');
                    const program = compileFirstWord(script);
                    expect(program.opCodes).to.eql([
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.OPEN_FRAME,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.EVALUATE_SENTENCE,
                      OpCode.PUSH_RESULT,
                      OpCode.RESOLVE_VALUE,
                      OpCode.PUSH_CONSTANT,
                      OpCode.CLOSE_FRAME,
                      OpCode.JOIN_STRINGS,
                    ]);
                    expect(program.constants).to.eql([
                      STR("this "),
                      STR("cmd"),
                      STR(" a string"),
                    ]);

                    commandResolver.register(
                      "cmd",
                      new FunctionCommand(() => STR("var"))
                    );
                    variableResolver.register("var", STR("is"));
                    expect(evaluate(program)).to.eql(STR("this is a string"));
                  });
                });
              });

              describe("indexed selectors", () => {
                specify("simple substitution", () => {
                  const script = parse('"this $varname[1] a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.SELECT_INDEX,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("varname"),
                    STR("1"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "varname",
                    LIST([STR("value"), STR("is")])
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("double substitution", () => {
                  const script = parse('"this $$var1[0] a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.SELECT_INDEX,
                    OpCode.RESOLVE_VALUE,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("var1"),
                    STR("0"),
                    STR(" a string"),
                  ]);

                  variableResolver.register("var1", LIST([STR("var2")]));
                  variableResolver.register("var2", STR("is"));
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("successive indexes", () => {
                  const script = parse('"this $varname[1][0] a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.SELECT_INDEX,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.EVALUATE_SENTENCE,
                    OpCode.PUSH_RESULT,
                    OpCode.SELECT_INDEX,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("varname"),
                    STR("1"),
                    STR("0"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "varname",
                    LIST([STR("value1"), LIST([STR("is"), STR("value2")])])
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
              });

              describe("keyed selectors", () => {
                specify("simple substitution", () => {
                  const script = parse('"this $varname(key) a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_KEYS,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("varname"),
                    STR("key"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "varname",
                    DICT({
                      key: STR("is"),
                    })
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("double substitution", () => {
                  const script = parse('"this $$var1(key) a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_KEYS,
                    OpCode.RESOLVE_VALUE,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("var1"),
                    STR("key"),
                    STR(" a string"),
                  ]);

                  variableResolver.register("var1", DICT({ key: STR("var2") }));
                  variableResolver.register("var2", STR("is"));
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("successive keys", () => {
                  const script = parse('"this $varname(key1)(key2) a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_KEYS,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_KEYS,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("varname"),
                    STR("key1"),
                    STR("key2"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "varname",
                    DICT({
                      key1: DICT({ key2: STR("is") }),
                    })
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
              });

              describe("custom selectors", () => {
                beforeEach(() => {
                  const lastSelector = {
                    apply(value: Value): Result {
                      const list = value as ListValue;
                      return OK(list.values[list.values.length - 1]);
                    },
                  };
                  selectorResolver.register(() => lastSelector);
                });
                specify("simple substitution", () => {
                  const script = parse('"this $varname{last} a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_RULES,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("varname"),
                    STR("last"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "varname",
                    LIST([STR("value1"), STR("value2"), STR("is")])
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("double substitution", () => {
                  const script = parse('"this $$var1{last} a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_RULES,
                    OpCode.RESOLVE_VALUE,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("var1"),
                    STR("last"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "var1",
                    LIST([STR("var2"), STR("var3")])
                  );
                  variableResolver.register("var3", STR("is"));
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
                specify("successive selectors", () => {
                  const script = parse('"this $var{last}{last} a string"');
                  const program = compileFirstWord(script);
                  expect(program.opCodes).to.eql([
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.PUSH_CONSTANT,
                    OpCode.RESOLVE_VALUE,
                    OpCode.OPEN_FRAME,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_RULES,
                    OpCode.OPEN_FRAME,
                    OpCode.OPEN_FRAME,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.CLOSE_FRAME,
                    OpCode.SELECT_RULES,
                    OpCode.PUSH_CONSTANT,
                    OpCode.CLOSE_FRAME,
                    OpCode.JOIN_STRINGS,
                  ]);
                  expect(program.constants).to.eql([
                    STR("this "),
                    STR("var"),
                    STR("last"),
                    STR("last"),
                    STR(" a string"),
                  ]);

                  variableResolver.register(
                    "var",
                    LIST([STR("value1"), LIST([STR("value2"), STR("is")])])
                  );
                  expect(evaluate(program)).to.eql(STR("this is a string"));
                });
              });

              specify("string with multiple substitutions", () => {
                const script = parse(
                  '"this $$var1$${variable 2} [cmd1] with subst[cmd2]${var3}[cmd3]$var4"'
                );
                const program = compileFirstWord(script);

                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                  OpCode.PUSH_CONSTANT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.JOIN_STRINGS,
                ]);
                expect(program.constants).to.eql([
                  STR("this "),
                  STR("var1"),
                  STR("variable 2"),
                  STR(" "),
                  STR("cmd1"),
                  STR(" with subst"),
                  STR("cmd2"),
                  STR("var3"),
                  STR("cmd3"),
                  STR("var4"),
                ]);

                variableResolver.register("var1", STR("var5"));
                variableResolver.register("var5", STR("is"));
                variableResolver.register("variable 2", STR("var6"));
                variableResolver.register("var6", STR(" a"));
                commandResolver.register(
                  "cmd1",
                  new FunctionCommand(() => STR("string"))
                );
                commandResolver.register(
                  "cmd2",
                  new FunctionCommand(() => STR("it"))
                );
                variableResolver.register(
                  "var3",
                  LIST([STR("foo"), STR("ut")])
                );
                commandResolver.register(
                  "cmd3",
                  new FunctionCommand(() => INT(1))
                );
                variableResolver.register("var4", STR("ions"));
                expect(evaluate(program)).to.eql(
                  STR("this is a string with substitutions")
                );
              });
            });

            specify("here-strings", () => {
              const script = parse('"""this is a "\'\\ $ \nhere-string"""');
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
              expect(program.constants).to.eql([
                STR("this is a \"'\\ $ \nhere-string"),
              ]);

              expect(evaluate(program)).to.eql(
                STR("this is a \"'\\ $ \nhere-string")
              );
            });

            specify("tagged strings", () => {
              const script = parse(
                '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
              );
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
              expect(program.constants).to.eql([
                STR("this is \n a \n \"'\\ $ tagged string\n"),
              ]);

              expect(evaluate(program)).to.eql(
                STR("this is \n a \n \"'\\ $ tagged string\n")
              );
            });
          });

          describe("compounds", () => {
            specify("literal prefix", () => {
              const script = parse("this_${var}(key)_a_[cmd a b]_compound");
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.RESOLVE_VALUE,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.SELECT_KEYS,
                OpCode.PUSH_CONSTANT,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.JOIN_STRINGS,
              ]);
              expect(program.constants).to.eql([
                STR("this_"),
                STR("var"),
                STR("key"),
                STR("_a_"),
                STR("cmd"),
                STR("a"),
                STR("b"),
                STR("_compound"),
              ]);

              variableResolver.register("var", DICT({ key: STR("is") }));
              commandResolver.register(
                "cmd",
                new FunctionCommand(() => STR("literal-prefixed"))
              );
              expect(evaluate(program)).to.eql(
                STR("this_is_a_literal-prefixed_compound")
              );
            });
            specify("expression prefix", () => {
              const script = parse("[cmd a b]_is_an_${var}(key)_compound");
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([
                OpCode.OPEN_FRAME,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.RESOLVE_VALUE,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.SELECT_KEYS,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.JOIN_STRINGS,
              ]);
              expect(program.constants).to.eql([
                STR("cmd"),
                STR("a"),
                STR("b"),
                STR("_is_an_"),
                STR("var"),
                STR("key"),
                STR("_compound"),
              ]);

              commandResolver.register(
                "cmd",
                new FunctionCommand(() => STR("this"))
              );
              variableResolver.register(
                "var",
                DICT({ key: STR("expression-prefixed") })
              );
              expect(evaluate(program)).to.eql(
                STR("this_is_an_expression-prefixed_compound")
              );
            });
            specify("substitution prefix", () => {
              const script = parse("${var}(key)_is_a_[cmd a b]_compound");
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.RESOLVE_VALUE,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.SELECT_KEYS,
                OpCode.PUSH_CONSTANT,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.JOIN_STRINGS,
              ]);
              expect(program.constants).to.eql([
                STR("var"),
                STR("key"),
                STR("_is_a_"),
                STR("cmd"),
                STR("a"),
                STR("b"),
                STR("_compound"),
              ]);

              variableResolver.register("var", DICT({ key: STR("this") }));
              commandResolver.register(
                "cmd",
                new FunctionCommand(() => STR("substitution-prefixed"))
              );
              expect(evaluate(program)).to.eql(
                STR("this_is_a_substitution-prefixed_compound")
              );
            });
          });

          describe("substitutions", () => {
            describe("scalars", () => {
              specify("simple substitution", () => {
                const script = parse("$varname");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("varname")]);

                variableResolver.register("varname", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("double substitution", () => {
                const script = parse("$$var1");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1")]);

                variableResolver.register("var1", STR("var2"));
                variableResolver.register("var2", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("triple substitution", () => {
                const script = parse("$$$var1");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1")]);

                variableResolver.register("var1", STR("var2"));
                variableResolver.register("var2", STR("var3"));
                variableResolver.register("var3", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
            });

            describe("tuples", () => {
              specify("single variable", () => {
                const script = parse("$(varname)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("varname")]);

                variableResolver.register("varname", STR("value"));
                expect(evaluate(program)).to.eql(TUPLE([STR("value")]));
              });
              specify("multiple variables", () => {
                const script = parse("$(var1 var2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("var2")]);

                variableResolver.register("var1", STR("value1"));
                variableResolver.register("var2", STR("value2"));
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), STR("value2")])
                );
              });
              specify("double substitution", () => {
                const script = parse("$$(var1)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1")]);

                variableResolver.register("var1", STR("var2"));
                variableResolver.register("var2", STR("value"));
                expect(evaluate(program)).to.eql(TUPLE([STR("value")]));
              });
              specify("nested tuples", () => {
                const script = parse("$(var1 (var2))");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("var2")]);

                variableResolver.register("var1", STR("value1"));
                variableResolver.register("var2", STR("value2"));
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), TUPLE([STR("value2")])])
                );
              });
              specify("nested double substitution", () => {
                const script = parse("$$((var1))");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1")]);

                variableResolver.register("var1", STR("var2"));
                variableResolver.register("var2", STR("value"));
                expect(evaluate(program)).to.eql(
                  TUPLE([TUPLE([STR("value")])])
                );
              });
            });

            describe("blocks", () => {
              specify("varname with spaces", () => {
                const script = parse("${variable name}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("variable name")]);

                variableResolver.register("variable name", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("varname with special characters", () => {
                const script = parse('${variable " " name}');
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR('variable " " name')]);

                variableResolver.register('variable " " name', STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("varname with continuations", () => {
                const script = parse("${variable\\\n \t\r     name}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("variable name")]);

                variableResolver.register("variable name", STR("value"));
                variableResolver.register('variable " " name', STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
            });

            describe("expressions", () => {
              specify("simple substitution", () => {
                const script = parse("$[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                ]);
                expect(program.constants).to.eql([STR("cmd")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() =>
                    LIST([STR("value1"), STR("value2")])
                  )
                );
                expect(evaluate(program)).to.eql(
                  LIST([STR("value1"), STR("value2")])
                );
              });
              specify("double substitution, scalar", () => {
                const script = parse("$$[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("cmd")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("var"))
                );
                variableResolver.register("var", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("double substitution, tuple", () => {
                const script = parse("$$[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("cmd")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => TUPLE([STR("var1"), STR("var2")]))
                );
                variableResolver.register("var1", STR("value1"));
                variableResolver.register("var2", STR("value2"));
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), STR("value2")])
                );
              });
              specify("two sentences", () => {
                const script = parse("[cmd1 result1; cmd2 result2]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                ]);
                expect(program.constants).to.eql([
                  STR("cmd1"),
                  STR("result1"),
                  STR("cmd2"),
                  STR("result2"),
                ]);

                const called = {};
                const fn: Command = new FunctionCommand((args) => {
                  const cmd = args[0].asString();
                  called[cmd] = called[cmd] ?? 0 + 1;
                  return args[1];
                });
                commandResolver.register("cmd1", fn);
                commandResolver.register("cmd2", fn);
                expect(evaluate(program)).to.eql(STR("result2"));
                expect(called).to.eql({ cmd1: 1, cmd2: 1 });
              });
              specify("indirect command", () => {
                const script = parse("[$cmdname]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                ]);
                expect(program.constants).to.eql([STR("cmdname")]);

                variableResolver.register("cmdname", STR("cmd"));
                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("value"))
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
            });

            describe("indexed selectors", () => {
              specify("simple substitution", () => {
                const script = parse("$varname[1]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([STR("varname"), STR("1")]);

                variableResolver.register(
                  "varname",
                  LIST([STR("value1"), STR("value2")])
                );
                expect(evaluate(program)).to.eql(STR("value2"));
              });
              specify("double substitution", () => {
                const script = parse("$$var1[0]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("0")]);

                variableResolver.register("var1", LIST([STR("var2")]));
                variableResolver.register("var2", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("successive indexes", () => {
                const script = parse("$varname[1][0]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("1"),
                  STR("0"),
                ]);

                variableResolver.register(
                  "varname",
                  LIST([
                    STR("value1"),
                    LIST([STR("value2_1"), STR("value2_2")]),
                  ])
                );
                expect(evaluate(program)).to.eql(STR("value2_1"));
              });
              specify("indirect index", () => {
                const script = parse("$var1[$var2]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("var2")]);

                variableResolver.register(
                  "var1",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                variableResolver.register("var2", STR("1"));
                expect(evaluate(program)).to.eql(STR("value2"));
              });
              specify("command index", () => {
                const script = parse("$varname[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([STR("varname"), STR("cmd")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("1"))
                );
                variableResolver.register(
                  "varname",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                expect(evaluate(program)).to.eql(STR("value2"));
              });
              specify("scalar expression", () => {
                const script = parse("$[cmd][0]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([STR("cmd"), STR("0")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => LIST([STR("value")]))
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("tuple expression", () => {
                const script = parse("$[cmd][0]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([STR("cmd"), STR("0")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() =>
                    TUPLE([LIST([STR("value1")]), LIST([STR("value2")])])
                  )
                );
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), STR("value2")])
                );
              });
            });

            describe("keyed selectors", () => {
              specify("simple substitution", () => {
                const script = parse("$varname(key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([STR("varname"), STR("key")]);

                variableResolver.register(
                  "varname",
                  DICT({
                    key: STR("value"),
                  })
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("double substitution", () => {
                const script = parse("$$var1(key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("key")]);

                variableResolver.register("var1", DICT({ key: STR("var2") }));
                variableResolver.register("var2", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("recursive keys", () => {
                const script = parse("$varname(key1 key2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("key1"),
                  STR("key2"),
                ]);

                variableResolver.register(
                  "varname",
                  DICT({
                    key1: DICT({ key2: STR("value") }),
                  })
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("successive keys", () => {
                const script = parse("$varname(key1)(key2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("key1"),
                  STR("key2"),
                ]);

                variableResolver.register(
                  "varname",
                  DICT({
                    key1: DICT({ key2: STR("value") }),
                  })
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("indirect key", () => {
                const script = parse("$var1($var2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("var2")]);

                variableResolver.register(
                  "var1",
                  DICT({
                    key: STR("value"),
                  })
                );
                variableResolver.register("var2", STR("key"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("string key", () => {
                const script = parse('$varname("arbitrary key")');
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.JOIN_STRINGS,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("arbitrary key"),
                ]);

                variableResolver.register(
                  "varname",
                  DICT({
                    "arbitrary key": STR("value"),
                  })
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("block key", () => {
                const script = parse("$varname({arbitrary key})");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  new ScriptValue(parse("arbitrary key"), "arbitrary key"),
                ]);

                variableResolver.register(
                  "varname",
                  DICT({
                    "arbitrary key": STR("value"),
                  })
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("tuple", () => {
                const script = parse("$(var1 var2)(key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("var1"),
                  STR("var2"),
                  STR("key"),
                ]);

                variableResolver.register("var1", DICT({ key: STR("value1") }));
                variableResolver.register("var2", DICT({ key: STR("value2") }));
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), STR("value2")])
                );
              });
              specify("recursive tuple", () => {
                const script = parse("$(var1 (var2))(key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("var1"),
                  STR("var2"),
                  STR("key"),
                ]);

                variableResolver.register("var1", DICT({ key: STR("value1") }));
                variableResolver.register("var2", DICT({ key: STR("value2") }));
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), TUPLE([STR("value2")])])
                );
              });
              specify("tuple with double substitution", () => {
                const script = parse("$$(var1 var2)(key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([
                  STR("var1"),
                  STR("var2"),
                  STR("key"),
                ]);

                variableResolver.register("var1", DICT({ key: STR("var3") }));
                variableResolver.register("var2", DICT({ key: STR("var4") }));
                variableResolver.register("var3", STR("value3"));
                variableResolver.register("var4", STR("value4"));
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value3"), STR("value4")])
                );
              });
              specify("scalar expression", () => {
                const script = parse("$[cmd](key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([STR("cmd"), STR("key")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => DICT({ key: STR("value") }))
                );
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("tuple expression", () => {
                const script = parse("$[cmd](key)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([STR("cmd"), STR("key")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() =>
                    TUPLE([
                      DICT({ key: STR("value1") }),
                      DICT({ key: STR("value2") }),
                    ])
                  )
                );
                expect(evaluate(program)).to.eql(
                  TUPLE([STR("value1"), STR("value2")])
                );
              });
            });

            describe("custom selectors", () => {
              beforeEach(() => {
                const lastSelector = {
                  apply(value: Value): Result {
                    const list = value as ListValue;
                    return OK(list.values[list.values.length - 1]);
                  },
                };
                selectorResolver.register(() => lastSelector);
              });
              specify("simple substitution", () => {
                const script = parse("$varname{last}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([STR("varname"), STR("last")]);

                variableResolver.register(
                  "varname",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                expect(evaluate(program)).to.eql(STR("value3"));
              });
              specify("double substitution", () => {
                const script = parse("$$var1{last}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                  OpCode.RESOLVE_VALUE,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("last")]);

                variableResolver.register(
                  "var1",
                  LIST([STR("var2"), STR("var3")])
                );
                variableResolver.register("var3", STR("value"));
                expect(evaluate(program)).to.eql(STR("value"));
              });
              specify("successive selectors", () => {
                const script = parse("$var{last}{last}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([
                  STR("var"),
                  STR("last"),
                  STR("last"),
                ]);

                variableResolver.register(
                  "var",
                  LIST([
                    STR("value1"),
                    LIST([STR("value2_1"), STR("value2_2")]),
                  ])
                );
                expect(evaluate(program)).to.eql(STR("value2_2"));
              });
              specify("indirect selector", () => {
                const script = parse("$var1{$var2}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([STR("var1"), STR("var2")]);

                variableResolver.register(
                  "var1",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                variableResolver.register("var2", STR("last"));
                selectorResolver.register(() => ({
                  apply(value: Value): Result {
                    const list = value as ListValue;
                    return OK(list.values[list.values.length - 1]);
                  },
                }));
                expect(evaluate(program)).to.eql(STR("value3"));
              });
              specify("expression", () => {
                const script = parse("$[cmd]{last}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([STR("cmd"), STR("last")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() =>
                    LIST([STR("value1"), STR("value2")])
                  )
                );
                expect(evaluate(program)).to.eql(STR("value2"));
              });
            });
          });

          describe("qualified words", () => {
            describe("literal prefix", () => {
              specify("indexed selector", () => {
                const script = parse("varname[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([STR("varname"), STR("cmd")]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("index"))
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("varname"), [
                    new IndexedSelector(STR("index")),
                  ])
                );
              });
              specify("keyed selector", () => {
                const script = parse("varname(key1 key2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("key1"),
                  STR("key2"),
                ]);

                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("varname"), [
                    new KeyedSelector([STR("key1"), STR("key2")]),
                  ])
                );
              });
              specify("generic selector", () => {
                const script = parse("varname{rule1 arg1; rule2 arg2}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("rule1"),
                  STR("arg1"),
                  STR("rule2"),
                  STR("arg2"),
                ]);

                selectorResolver.register(
                  (rules) => new GenericSelector(rules)
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("varname"), [
                    new GenericSelector([
                      TUPLE([STR("rule1"), STR("arg1")]),
                      TUPLE([STR("rule2"), STR("arg2")]),
                    ]),
                  ])
                );
              });
              specify("complex case", () => {
                const script = parse(
                  "varname(key1 $var1){$var2; [cmd1]}[cmd2]([$var3])(key4)"
                );
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname"),
                  STR("key1"),
                  STR("var1"),
                  STR("var2"),
                  STR("cmd1"),
                  STR("cmd2"),
                  STR("var3"),
                  STR("key4"),
                ]);

                variableResolver.register("var1", STR("key2"));
                variableResolver.register("var2", STR("rule1"));
                variableResolver.register("var3", STR("cmd3"));
                commandResolver.register(
                  "cmd1",
                  new FunctionCommand(() => STR("rule2"))
                );
                commandResolver.register(
                  "cmd2",
                  new FunctionCommand(() => STR("index1"))
                );
                commandResolver.register(
                  "cmd3",
                  new FunctionCommand(() => STR("key3"))
                );
                selectorResolver.register(
                  (rules) => new GenericSelector(rules)
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("varname"), [
                    new KeyedSelector([STR("key1"), STR("key2")]),
                    new GenericSelector([
                      TUPLE([STR("rule1")]),
                      TUPLE([STR("rule2")]),
                    ]),
                    new IndexedSelector(STR("index1")),
                    new KeyedSelector([STR("key3"), STR("key4")]),
                  ])
                );
              });
            });
            describe("tuple prefix", () => {
              specify("indexed selector", () => {
                const script = parse("(varname1 varname2)[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([
                  STR("varname1"),
                  STR("varname2"),
                  STR("cmd"),
                ]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("index"))
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(
                    TUPLE([STR("varname1"), STR("varname2")]),
                    [new IndexedSelector(STR("index"))]
                  )
                );
              });
              specify("keyed selector", () => {
                const script = parse("(varname1 varname2)(key1 key2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("varname1"),
                  STR("varname2"),
                  STR("key1"),
                  STR("key2"),
                ]);

                expect(evaluate(program)).to.eql(
                  new QualifiedValue(
                    TUPLE([STR("varname1"), STR("varname2")]),
                    [new KeyedSelector([STR("key1"), STR("key2")])]
                  )
                );
              });
              specify("generic selector", () => {
                const script = parse(
                  "(varname1 varname2){rule1 arg1; rule2 arg2}"
                );
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([
                  STR("varname1"),
                  STR("varname2"),
                  STR("rule1"),
                  STR("arg1"),
                  STR("rule2"),
                  STR("arg2"),
                ]);

                selectorResolver.register(
                  (rules) => new GenericSelector(rules)
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(
                    TUPLE([STR("varname1"), STR("varname2")]),
                    [
                      new GenericSelector([
                        TUPLE([STR("rule1"), STR("arg1")]),
                        TUPLE([STR("rule2"), STR("arg2")]),
                      ]),
                    ]
                  )
                );
              });
              specify("complex case", () => {
                const script = parse(
                  "(varname1 $var1)[cmd1](key1 $var2)([$var3]){$var4; [cmd2]}[cmd4]"
                );
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([
                  STR("varname1"),
                  STR("var1"),
                  STR("cmd1"),
                  STR("key1"),
                  STR("var2"),
                  STR("var3"),
                  STR("var4"),
                  STR("cmd2"),
                  STR("cmd4"),
                ]);

                variableResolver.register("var1", STR("varname2"));
                variableResolver.register("var2", STR("key2"));
                variableResolver.register("var3", STR("cmd3"));
                variableResolver.register("var4", STR("rule1"));
                commandResolver.register(
                  "cmd1",
                  new FunctionCommand(() => STR("index1"))
                );
                commandResolver.register(
                  "cmd2",
                  new FunctionCommand(() => STR("rule2"))
                );
                commandResolver.register(
                  "cmd3",
                  new FunctionCommand(() => STR("key3"))
                );
                commandResolver.register(
                  "cmd4",
                  new FunctionCommand(() => STR("index2"))
                );
                selectorResolver.register(
                  (rules) => new GenericSelector(rules)
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(
                    TUPLE([STR("varname1"), STR("varname2")]),
                    [
                      new IndexedSelector(STR("index1")),
                      new KeyedSelector([
                        STR("key1"),
                        STR("key2"),
                        STR("key3"),
                      ]),
                      new GenericSelector([
                        TUPLE([STR("rule1")]),
                        TUPLE([STR("rule2")]),
                      ]),
                      new IndexedSelector(STR("index2")),
                    ]
                  )
                );
              });
            });
            describe("block prefix", () => {
              specify("indexed selector", () => {
                const script = parse("{source name}[cmd]");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                ]);
                expect(program.constants).to.eql([
                  STR("source name"),
                  STR("cmd"),
                ]);

                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("index"))
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("source name"), [
                    new IndexedSelector(STR("index")),
                  ])
                );
              });
              specify("keyed selector", () => {
                const script = parse("{source name}(key1 key2)");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("source name"),
                  STR("key1"),
                  STR("key2"),
                ]);

                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("source name"), [
                    new KeyedSelector([STR("key1"), STR("key2")]),
                  ])
                );
              });
              specify("generic selector", () => {
                const script = parse("{source name}{rule1 arg1; rule2 arg2}");
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                ]);
                expect(program.constants).to.eql([
                  STR("source name"),
                  STR("rule1"),
                  STR("arg1"),
                  STR("rule2"),
                  STR("arg2"),
                ]);

                selectorResolver.register(
                  (rules) => new GenericSelector(rules)
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("source name"), [
                    new GenericSelector([
                      TUPLE([STR("rule1"), STR("arg1")]),
                      TUPLE([STR("rule2"), STR("arg2")]),
                    ]),
                  ])
                );
              });
              specify("complex case", () => {
                const script = parse(
                  "{source name}(key1 $var1){$var2; [cmd1]}[cmd2]([$var3])(key4)"
                );
                const program = compileFirstWord(script);
                expect(program.opCodes).to.eql([
                  OpCode.PUSH_CONSTANT,
                  OpCode.SET_SOURCE,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.CLOSE_FRAME,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_RULES,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.SELECT_INDEX,
                  OpCode.OPEN_FRAME,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.RESOLVE_VALUE,
                  OpCode.CLOSE_FRAME,
                  OpCode.EVALUATE_SENTENCE,
                  OpCode.PUSH_RESULT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                  OpCode.OPEN_FRAME,
                  OpCode.PUSH_CONSTANT,
                  OpCode.CLOSE_FRAME,
                  OpCode.SELECT_KEYS,
                ]);
                expect(program.constants).to.eql([
                  STR("source name"),
                  STR("key1"),
                  STR("var1"),
                  STR("var2"),
                  STR("cmd1"),
                  STR("cmd2"),
                  STR("var3"),
                  STR("key4"),
                ]);

                variableResolver.register("var1", STR("key2"));
                variableResolver.register("var2", STR("rule1"));
                variableResolver.register("var3", STR("cmd3"));
                commandResolver.register(
                  "cmd1",
                  new FunctionCommand(() => STR("rule2"))
                );
                commandResolver.register(
                  "cmd2",
                  new FunctionCommand(() => STR("index1"))
                );
                commandResolver.register(
                  "cmd3",
                  new FunctionCommand(() => STR("key3"))
                );
                selectorResolver.register(
                  (rules) => new GenericSelector(rules)
                );
                expect(evaluate(program)).to.eql(
                  new QualifiedValue(STR("source name"), [
                    new KeyedSelector([STR("key1"), STR("key2")]),
                    new GenericSelector([
                      TUPLE([STR("rule1")]),
                      TUPLE([STR("rule2")]),
                    ]),
                    new IndexedSelector(STR("index1")),
                    new KeyedSelector([STR("key3"), STR("key4")]),
                  ])
                );
              });
            });
          });

          describe("ignored words", () => {
            specify("line comments", () => {
              const script = parse("# this ; is$ (\\\na [comment{");
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([]);
            });

            specify("block comments", () => {
              const script = parse("##{ this \n ; is$ (a  \n#{comment{[( }##");
              const program = compileFirstWord(script);
              expect(program.opCodes).to.eql([]);
            });
          });
        });

        specify("constants", () => {
          const value = STR("value");
          const program = compiler.compileConstant(value);
          expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
          expect(program.constants).to.eql([STR("value")]);

          expect(evaluate(program)).to.eql(STR("value"));
        });

        describe("word expansion", () => {
          specify("tuples", () => {
            const script = parse("(prefix $*var suffix)");
            const program = compileFirstWord(script);
            expect(program.opCodes).to.eql([
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.RESOLVE_VALUE,
              OpCode.EXPAND_VALUE,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
            ]);
            expect(program.constants).to.eql([
              STR("prefix"),
              STR("var"),
              STR("suffix"),
            ]);

            variableResolver.register(
              "var",
              TUPLE([STR("value1"), STR("value2")])
            );
            expect(evaluate(program)).to.eql(
              TUPLE([
                STR("prefix"),
                STR("value1"),
                STR("value2"),
                STR("suffix"),
              ])
            );
          });
          specify("expressions", () => {
            const script = parse("(prefix $*[cmd] suffix)");
            const program = compileFirstWord(script);
            expect(program.opCodes).to.eql([
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
              OpCode.EVALUATE_SENTENCE,
              OpCode.PUSH_RESULT,
              OpCode.EXPAND_VALUE,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
            ]);
            expect(program.constants).to.eql([
              STR("prefix"),
              STR("cmd"),
              STR("suffix"),
            ]);

            commandResolver.register(
              "cmd",
              new FunctionCommand(() => TUPLE([STR("value1"), STR("value2")]))
            );
            expect(evaluate(program)).to.eql(
              TUPLE([
                STR("prefix"),
                STR("value1"),
                STR("value2"),
                STR("suffix"),
              ])
            );
          });
          describe("scripts", () => {
            beforeEach(() => {
              commandResolver.register(
                "cmd",
                new FunctionCommand((args) => TUPLE(args))
              );
            });
            specify("single variable", () => {
              const script = parse("cmd $*var arg");
              const program = compiler.compileScript(script);
              expect(program.opCodes).to.eql([
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.RESOLVE_VALUE,
                OpCode.EXPAND_VALUE,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
              ]);
              expect(program.constants).to.eql([
                STR("cmd"),
                STR("var"),
                STR("arg"),
              ]);

              variableResolver.register(
                "var",
                TUPLE([STR("value1"), STR("value2")])
              );
              expect(evaluate(program)).to.eql(
                TUPLE([STR("cmd"), STR("value1"), STR("value2"), STR("arg")])
              );
            });
            specify("multiple variables", () => {
              const script = parse("cmd $*(var1 var2) arg");
              const program = compiler.compileScript(script);
              expect(program.opCodes).to.eql([
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.RESOLVE_VALUE,
                OpCode.EXPAND_VALUE,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
              ]);
              expect(program.constants).to.eql([
                STR("cmd"),
                STR("var1"),
                STR("var2"),
                STR("arg"),
              ]);

              variableResolver.register("var1", STR("value1"));
              variableResolver.register("var2", STR("value2"));
              expect(evaluate(program)).to.eql(
                TUPLE([STR("cmd"), STR("value1"), STR("value2"), STR("arg")])
              );
            });
            specify("expressions", () => {
              const script = parse("cmd $*[cmd2] arg");
              const program = compiler.compileScript(script);
              expect(program.opCodes).to.eql([
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.OPEN_FRAME,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
                OpCode.EXPAND_VALUE,
                OpCode.PUSH_CONSTANT,
                OpCode.CLOSE_FRAME,
                OpCode.EVALUATE_SENTENCE,
                OpCode.PUSH_RESULT,
              ]);
              expect(program.constants).to.eql([
                STR("cmd"),
                STR("cmd2"),
                STR("arg"),
              ]);

              commandResolver.register(
                "cmd2",
                new FunctionCommand(() => TUPLE([STR("value1"), STR("value2")]))
              );
              expect(evaluate(program)).to.eql(
                TUPLE([STR("cmd"), STR("value1"), STR("value2"), STR("arg")])
              );
            });
          });
        });

        describe("scripts", () => {
          specify("empty", () => {
            const script = parse("");
            const program = compiler.compileScript(script);
            expect(program.opCodes).to.eql([]);
            expect(evaluate(program)).to.eql(NIL);
          });

          specify("conditional evaluation", () => {
            const script1 = parse("if true {cmd1 a} else {cmd2 b}");
            const program1 = compiler.compileScript(script1);
            expect(program1.opCodes).to.eql([
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
              OpCode.EVALUATE_SENTENCE,
              OpCode.PUSH_RESULT,
            ]);
            expect(program1.constants).to.eql([
              STR("if"),
              STR("true"),
              new ScriptValue(parse("cmd1 a"), "cmd1 a"),
              STR("else"),
              new ScriptValue(parse("cmd2 b"), "cmd2 b"),
            ]);

            const script2 = parse("if false {cmd1 a} else {cmd2 b}");
            const program2 = compiler.compileScript(script2);
            expect(program2.opCodes).to.eql([
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
              OpCode.EVALUATE_SENTENCE,
              OpCode.PUSH_RESULT,
            ]);
            expect(program2.constants).to.eql([
              STR("if"),
              STR("false"),
              new ScriptValue(parse("cmd1 a"), "cmd1 a"),
              STR("else"),
              new ScriptValue(parse("cmd2 b"), "cmd2 b"),
            ]);

            commandResolver.register(
              "if",
              new FunctionCommand((args) => {
                const condition = args[1];
                const block =
                  condition.asString() == "true" ? args[2] : args[4];
                const script =
                  block.type == ValueType.SCRIPT
                    ? (block as ScriptValue).script
                    : parse(block.asString());
                const program = compiler.compileScript(script);
                return evaluate(program);
              })
            );
            commandResolver.register(
              "cmd1",
              new FunctionCommand((args) => args[1])
            );
            commandResolver.register(
              "cmd2",
              new FunctionCommand((args) => args[1])
            );

            expect(evaluate(program1)).to.eql(STR("a"));
            expect(evaluate(program2)).to.eql(STR("b"));
          });

          specify("loop", () => {
            const script = parse("repeat 10 {cmd foo}");
            const program = compiler.compileScript(script);
            expect(program.opCodes).to.eql([
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
              OpCode.EVALUATE_SENTENCE,
              OpCode.PUSH_RESULT,
            ]);
            expect(program.constants).to.eql([
              STR("repeat"),
              STR("10"),
              new ScriptValue(parse("cmd foo"), "cmd foo"),
            ]);

            commandResolver.register(
              "repeat",
              new FunctionCommand((args) => {
                const nb = IntegerValue.toInteger(args[1]).data;
                const block = args[2];
                const script =
                  block.type == ValueType.SCRIPT
                    ? (block as ScriptValue).script
                    : parse(block.asString());
                const program = compiler.compileScript(script);
                let value: Value = NIL;
                for (let i = 0; i < nb; i++) {
                  value = evaluate(program);
                }
                return value;
              })
            );
            let counter = 0;
            let acc = "";
            commandResolver.register(
              "cmd",
              new FunctionCommand((args) => {
                const value = args[1].asString();
                acc += value;
                return INT(counter++);
              })
            );
            expect(evaluate(program)).to.eql(INT(9));
            expect(counter).to.eql(10);
            expect(acc).to.eql("foo".repeat(10));
          });
        });

        describe("sentences", () => {
          specify("single sentence", () => {
            const script = parse("cmd $*[cmd2] arg");
            const program = compiler.compileSentence(script.sentences[0]);
            expect(program.opCodes).to.eql([
              OpCode.PUSH_CONSTANT,
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
              OpCode.EVALUATE_SENTENCE,
              OpCode.PUSH_RESULT,
              OpCode.EXPAND_VALUE,
              OpCode.PUSH_CONSTANT,
            ]);
            expect(program.constants).to.eql([
              STR("cmd"),
              STR("cmd2"),
              STR("arg"),
            ]);
          });
          specify("multiple sentences", () => {
            const script = parse(
              "cmd1 $arg1 arg2; $*[cmd2] arg3; cmd3 $$arg4 arg5"
            );
            const program = compiler.compileSentences(script.sentences);
            expect(program.opCodes).to.eql([
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.RESOLVE_VALUE,
              OpCode.PUSH_CONSTANT,
              OpCode.OPEN_FRAME,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
              OpCode.EVALUATE_SENTENCE,
              OpCode.PUSH_RESULT,
              OpCode.EXPAND_VALUE,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.PUSH_CONSTANT,
              OpCode.RESOLVE_VALUE,
              OpCode.RESOLVE_VALUE,
              OpCode.PUSH_CONSTANT,
              OpCode.CLOSE_FRAME,
            ]);
            expect(program.constants).to.eql([
              STR("cmd1"),
              STR("arg1"),
              STR("arg2"),
              STR("cmd2"),
              STR("arg3"),
              STR("cmd3"),
              STR("arg4"),
              STR("arg5"),
            ]);
          });
        });
      });

      describe("Executor", () => {
        it("should pass opaque context to commands", () => {
          const script = parse("cmd");
          const program = compiler.compileScript(script);

          let commandContext;
          commandResolver.register("cmd", {
            execute: (_args, context) => {
              commandContext = context;
              return OK(NIL);
            },
          });

          const context = Symbol();
          executor = new Executor(
            variableResolver,
            commandResolver,
            selectorResolver,
            context
          );
          execute(program);
          expect(commandContext).to.equal(context);
        });

        describe("exceptions", () => {
          specify("invalid command name", () => {
            const script = parse("[]");
            const program = compiler.compileScript(script);

            expect(execute(program)).to.eql(ERROR("invalid command name"));
          });
          specify("invalid variable name", () => {
            const script = parse("$([])");
            const program = compiler.compileScript(script);

            expect(execute(program)).to.eql(ERROR("invalid variable name"));
          });
          specify("variable substitution with no string representation", () => {
            const script = parse('"$var"');
            const program = compiler.compileScript(script);

            variableResolver.register("var", NIL);

            expect(execute(program)).to.eql(
              ERROR("value has no string representation")
            );
          });
          specify("command substitution with no string representation", () => {
            const script = parse('"[]"');
            const program = compiler.compileScript(script);

            expect(execute(program)).to.eql(
              ERROR("value has no string representation")
            );
          });
        });
      });

      describe("Program", () => {
        it("should be resumable", () => {
          const script = parse(
            "break 1; ok 2; break 3; break 4; ok 5; break 6"
          );
          const program = compiler.compileScript(script);

          commandResolver.register("break", {
            execute(args) {
              return BREAK(args[1]);
            },
          });
          commandResolver.register("ok", {
            execute(args) {
              return OK(args[1]);
            },
          });
          const state = new ProgramState();
          expect(executor.execute(program, state)).to.eql(BREAK(STR("1")));
          expect(executor.execute(program, state)).to.eql(BREAK(STR("3")));
          expect(executor.execute(program, state)).to.eql(BREAK(STR("4")));
          expect(executor.execute(program, state)).to.eql(BREAK(STR("6")));
          expect(executor.execute(program, state)).to.eql(OK(STR("6")));
        });
        it("result should be settable", () => {
          const script = parse("ok [break 1]");
          const program = compiler.compileScript(script);

          commandResolver.register("break", {
            execute(args) {
              return BREAK(args[1]);
            },
          });
          commandResolver.register("ok", {
            execute(args) {
              return OK(args[1]);
            },
          });
          const state = new ProgramState();
          expect(executor.execute(program, state)).to.eql(BREAK(STR("1")));
          state.result = OK(STR("2"));
          expect(executor.execute(program, state)).to.eql(OK(STR("2")));
        });
        it("should support resumable commands", () => {
          const script = parse("ok [cmd]");
          const program = compiler.compileScript(script);

          commandResolver.register("cmd", {
            execute(_args) {
              return YIELD(INT(1));
            },
            resume(result) {
              const i = (result.value as IntegerValue).value;
              if (i == 5) return OK(STR("done"));
              return YIELD(INT(i + 1));
            },
          });
          commandResolver.register("ok", {
            execute(args) {
              return OK(args[1]);
            },
          });

          const state = new ProgramState();
          expect(executor.execute(program, state)).to.eql(YIELD(INT(1)));
          expect(executor.execute(program, state)).to.eql(YIELD(INT(2)));
          expect(executor.execute(program, state)).to.eql(YIELD(INT(3)));
          expect(executor.execute(program, state)).to.eql(YIELD(INT(4)));
          expect(executor.execute(program, state)).to.eql(YIELD(INT(5)));
          expect(executor.execute(program, state)).to.eql(OK(STR("done")));
        });
        it("should support resumable command state", () => {
          const script = parse("ok [cmd]");
          const program = compiler.compileScript(script);

          commandResolver.register("cmd", {
            execute(_args) {
              return YIELD(STR("begin"), 1);
            },
            resume(result) {
              const step = result.data as number;
              switch (step) {
                case 1:
                  return YIELD(STR(`step one`), step + 1);
                case 2:
                  return YIELD(STR(`step two`), step + 1);
                case 3:
                  return YIELD(STR(`step three`), step + 1);
                case 4:
                  return OK(STR("end"));
              }
            },
          });
          commandResolver.register("ok", {
            execute(args) {
              return OK(args[1]);
            },
          });

          const state = new ProgramState();
          expect(executor.execute(program, state)).to.eql(
            YIELD(STR("begin"), 1)
          );
          expect(executor.execute(program, state)).to.eql(
            YIELD(STR("step one"), 2)
          );
          expect(executor.execute(program, state)).to.eql(
            YIELD(STR("step two"), 3)
          );
          expect(executor.execute(program, state)).to.eql(
            YIELD(STR("step three"), 4)
          );
          expect(executor.execute(program, state)).to.eql(OK(STR("end")));
        });
      });
    });
  }
});
