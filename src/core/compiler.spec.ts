import { expect } from "chai";
import { Command, Result, OK, YIELD, BREAK } from "./command";
import {
  Compiler,
  OpCode,
  Executor,
  Program,
  ExecutionContext,
} from "./compiler";
import {
  VariableResolver,
  CommandResolver,
  SelectorResolver,
} from "./evaluator";
import { Parser } from "./parser";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";
import { BlockMorpheme, Script } from "./syntax";
import { Tokenizer } from "./tokenizer";
import {
  IntegerValue,
  ListValue,
  MapValue,
  NIL,
  QualifiedValue,
  ScriptValue,
  StringValue,
  TupleValue,
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
    if (name.type == ValueType.INTEGER || !isNaN(parseInt(name.asString())))
      return INT_CMD;
    return this.commands.get(name.asString());
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

describe("Compiler", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let variableResolver: MockVariableResolver;
  let commandResolver: MockCommandResolver;
  let selectorResolver: MockSelectorResolver;
  let compiler: Compiler;
  let executor: Executor;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const compileFirstWord = (script: Script) =>
    compiler.compileWord(script.sentences[0].words[0]);
  const evaluate = (program: Program) => executor.execute(program).value;

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

  describe("words", () => {
    describe("roots", () => {
      specify("literal", () => {
        const script = parse("word");
        const program = compileFirstWord(script);
        expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
        expect(program.constants).to.eql([new StringValue("word")]);

        expect(evaluate(program)).to.eql(new StringValue("word"));
      });

      describe("tuples", () => {
        specify("empty tuple", () => {
          const script = parse("()");
          const program = compileFirstWord(script);
          expect(program.opCodes).to.eql([
            OpCode.OPEN_FRAME,
            OpCode.CLOSE_FRAME,
          ]);

          expect(evaluate(program)).to.eql(new TupleValue([]));
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
          expect(program.constants).to.eql([
            new StringValue("lit1"),
            new StringValue("lit2"),
          ]);

          expect(evaluate(program)).to.eql(
            new TupleValue([new StringValue("lit1"), new StringValue("lit2")])
          );
        });
        specify("complex case", () => {
          const script = parse('( this [cmd] $var1 "complex" ${var2}(key) )');
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
            new StringValue("this"),
            new StringValue("cmd"),
            new StringValue("var1"),
            new StringValue("complex"),
            new StringValue("var2"),
            new StringValue("key"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("is"))
          );
          variableResolver.register("var1", new StringValue("a"));
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("tuple") })
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("this"),
              new StringValue("is"),
              new StringValue("a"),
              new StringValue("complex"),
              new StringValue("tuple"),
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
          const block = script.sentences[0].words[0]
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
          expect(program.constants).to.eql([
            new StringValue("cmd"),
            new StringValue("arg"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              (args) => new TupleValue([...args, new StringValue("foo")])
            )
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("cmd"),
              new StringValue("arg"),
              new StringValue("foo"),
            ])
          );
        });
        specify("complex case", () => {
          const script = parse('[ this [cmd] $var1 "complex" ${var2}(key) ]');
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
            new StringValue("this"),
            new StringValue("cmd"),
            new StringValue("var1"),
            new StringValue("complex"),
            new StringValue("var2"),
            new StringValue("key"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("is"))
          );
          variableResolver.register("var1", new StringValue("a"));
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("expression") })
          );
          commandResolver.register(
            "this",
            new FunctionCommand((args) => new TupleValue(args))
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("this"),
              new StringValue("is"),
              new StringValue("a"),
              new StringValue("complex"),
              new StringValue("expression"),
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

          expect(evaluate(program)).to.eql(new StringValue(""));
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
          expect(program.constants).to.eql([
            new StringValue("this is a string"),
          ]);

          expect(evaluate(program)).to.eql(new StringValue("this is a string"));
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
              new StringValue("this "),
              new StringValue("cmd"),
              new StringValue(" a string"),
            ]);

            commandResolver.register(
              "cmd",
              new FunctionCommand(() => new StringValue("is"))
            );
            expect(evaluate(program)).to.eql(
              new StringValue("this is a string")
            );
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
              new StringValue("this "),
              new StringValue("cmd1"),
              new StringValue("cmd2"),
              new StringValue(" a string"),
            ]);

            commandResolver.register(
              "cmd1",
              new FunctionCommand(() => new StringValue("i"))
            );
            commandResolver.register(
              "cmd2",
              new FunctionCommand(() => new StringValue("s"))
            );
            expect(evaluate(program)).to.eql(
              new StringValue("this is a string")
            );
          });
        });

        specify("string with multiple substitutions", () => {
          const script = parse(
            '"this $var1 ${variable 2} [cmd1] with subst[cmd2]${var3}[cmd3]$var4"'
          );
          const program = compileFirstWord(script);

          expect(program.opCodes).to.eql([
            OpCode.OPEN_FRAME,
            OpCode.PUSH_CONSTANT,
            OpCode.PUSH_CONSTANT,
            OpCode.RESOLVE_VALUE,
            OpCode.PUSH_CONSTANT,
            OpCode.PUSH_CONSTANT,
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
            new StringValue("this "),
            new StringValue("var1"),
            new StringValue(" "),
            new StringValue("variable 2"),
            new StringValue(" "),
            new StringValue("cmd1"),
            new StringValue(" with subst"),
            new StringValue("cmd2"),
            new StringValue("var3"),
            new StringValue("cmd3"),
            new StringValue("var4"),
          ]);

          variableResolver.register("var1", new StringValue("is"));
          variableResolver.register("variable 2", new StringValue("a"));
          commandResolver.register(
            "cmd1",
            new FunctionCommand(() => new StringValue("string"))
          );
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => new StringValue("it"))
          );
          variableResolver.register(
            "var3",
            new ListValue([new StringValue("foo"), new StringValue("ut")])
          );
          commandResolver.register(
            "cmd3",
            new FunctionCommand(() => new IntegerValue(1))
          );
          variableResolver.register("var4", new StringValue("ions"));
          expect(evaluate(program)).to.eql(
            new StringValue("this is a string with substitutions")
          );
        });
      });

      specify("here-strings", () => {
        const script = parse('"""this is a "\'\\ $ \nhere-string"""');
        const program = compileFirstWord(script);
        expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
        expect(program.constants).to.eql([
          new StringValue("this is a \"'\\ $ \nhere-string"),
        ]);

        expect(evaluate(program)).to.eql(
          new StringValue("this is a \"'\\ $ \nhere-string")
        );
      });

      specify("tagged strings", () => {
        const script = parse(
          '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
        );
        const program = compileFirstWord(script);
        expect(program.opCodes).to.eql([OpCode.PUSH_CONSTANT]);
        expect(program.constants).to.eql([
          new StringValue("this is \n a \n \"'\\ $ tagged string\n"),
        ]);

        expect(evaluate(program)).to.eql(
          new StringValue("this is \n a \n \"'\\ $ tagged string\n")
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
          new StringValue("this_"),
          new StringValue("var"),
          new StringValue("key"),
          new StringValue("_a_"),
          new StringValue("cmd"),
          new StringValue("a"),
          new StringValue("b"),
          new StringValue("_compound"),
        ]);

        variableResolver.register(
          "var",
          new MapValue({ key: new StringValue("is") })
        );
        commandResolver.register(
          "cmd",
          new FunctionCommand(() => new StringValue("literal-prefixed"))
        );
        expect(evaluate(program)).to.eql(
          new StringValue("this_is_a_literal-prefixed_compound")
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
          new StringValue("cmd"),
          new StringValue("a"),
          new StringValue("b"),
          new StringValue("_is_an_"),
          new StringValue("var"),
          new StringValue("key"),
          new StringValue("_compound"),
        ]);

        commandResolver.register(
          "cmd",
          new FunctionCommand(() => new StringValue("this"))
        );
        variableResolver.register(
          "var",
          new MapValue({ key: new StringValue("expression-prefixed") })
        );
        expect(evaluate(program)).to.eql(
          new StringValue("this_is_an_expression-prefixed_compound")
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
          new StringValue("var"),
          new StringValue("key"),
          new StringValue("_is_a_"),
          new StringValue("cmd"),
          new StringValue("a"),
          new StringValue("b"),
          new StringValue("_compound"),
        ]);

        variableResolver.register(
          "var",
          new MapValue({ key: new StringValue("this") })
        );
        commandResolver.register(
          "cmd",
          new FunctionCommand(() => new StringValue("substitution-prefixed"))
        );
        expect(evaluate(program)).to.eql(
          new StringValue("this_is_a_substitution-prefixed_compound")
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
          expect(program.constants).to.eql([new StringValue("varname")]);

          variableResolver.register("varname", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
        });
        specify("double substitution", () => {
          const script = parse("$$var1");
          const program = compileFirstWord(script);
          expect(program.opCodes).to.eql([
            OpCode.PUSH_CONSTANT,
            OpCode.RESOLVE_VALUE,
            OpCode.RESOLVE_VALUE,
          ]);
          expect(program.constants).to.eql([new StringValue("var1")]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([new StringValue("var1")]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("var3"));
          variableResolver.register("var3", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([new StringValue("varname")]);

          variableResolver.register("varname", new StringValue("value"));
          expect(evaluate(program)).to.eql(
            new TupleValue([new StringValue("value")])
          );
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("var2"),
          ]);

          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
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
          expect(program.constants).to.eql([new StringValue("var1")]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          expect(evaluate(program)).to.eql(
            new TupleValue([new StringValue("value")])
          );
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("var2"),
          ]);

          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new TupleValue([new StringValue("value2")]),
            ])
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
          expect(program.constants).to.eql([new StringValue("var1")]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          expect(evaluate(program)).to.eql(
            new TupleValue([new TupleValue([new StringValue("value")])])
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
          expect(program.constants).to.eql([new StringValue("variable name")]);

          variableResolver.register("variable name", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
        });
        specify("varname with special characters", () => {
          const script = parse('${variable " " name}');
          const program = compileFirstWord(script);
          expect(program.opCodes).to.eql([
            OpCode.PUSH_CONSTANT,
            OpCode.RESOLVE_VALUE,
          ]);
          expect(program.constants).to.eql([
            new StringValue('variable " " name'),
          ]);

          variableResolver.register(
            'variable " " name',
            new StringValue("value")
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
        });
        specify("varname with continuations", () => {
          const script = parse("${variable\\\n \t\r     name}");
          const program = compileFirstWord(script);
          expect(program.opCodes).to.eql([
            OpCode.PUSH_CONSTANT,
            OpCode.RESOLVE_VALUE,
          ]);
          expect(program.constants).to.eql([new StringValue("variable name")]);

          variableResolver.register("variable name", new StringValue("value"));
          variableResolver.register(
            'variable " " name',
            new StringValue("value")
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([new StringValue("cmd")]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () =>
                new ListValue([
                  new StringValue("value1"),
                  new StringValue("value2"),
                ])
            )
          );
          expect(evaluate(program)).to.eql(
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
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
          expect(program.constants).to.eql([new StringValue("cmd")]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("var"))
          );
          variableResolver.register("var", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([new StringValue("cmd")]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () =>
                new TupleValue([
                  new StringValue("var1"),
                  new StringValue("var2"),
                ])
            )
          );
          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
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
            new StringValue("cmd1"),
            new StringValue("result1"),
            new StringValue("cmd2"),
            new StringValue("result2"),
          ]);

          const called = {};
          const fn: Command = new FunctionCommand((args) => {
            const cmd = args[0].asString();
            called[cmd] = called[cmd] ?? 0 + 1;
            return args[1];
          });
          commandResolver.register("cmd1", fn);
          commandResolver.register("cmd2", fn);
          expect(evaluate(program)).to.eql(new StringValue("result2"));
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
          expect(program.constants).to.eql([new StringValue("cmdname")]);

          variableResolver.register("cmdname", new StringValue("cmd"));
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("value"))
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([
            new StringValue("varname"),
            new StringValue("1"),
          ]);

          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
          expect(evaluate(program)).to.eql(new StringValue("value2"));
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("0"),
          ]);

          variableResolver.register(
            "var1",
            new ListValue([new StringValue("var2")])
          );
          variableResolver.register("var2", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("varname"),
            new StringValue("1"),
            new StringValue("0"),
          ]);

          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new ListValue([
                new StringValue("value2_1"),
                new StringValue("value2_2"),
              ]),
            ])
          );
          expect(evaluate(program)).to.eql(new StringValue("value2_1"));
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("var2"),
          ]);

          variableResolver.register(
            "var1",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          variableResolver.register("var2", new StringValue("1"));
          expect(evaluate(program)).to.eql(new StringValue("value2"));
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
          expect(program.constants).to.eql([
            new StringValue("varname"),
            new StringValue("cmd"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("1"))
          );
          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          expect(evaluate(program)).to.eql(new StringValue("value2"));
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
          expect(program.constants).to.eql([
            new StringValue("cmd"),
            new StringValue("0"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new ListValue([new StringValue("value")]))
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([
            new StringValue("cmd"),
            new StringValue("0"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () =>
                new TupleValue([
                  new ListValue([new StringValue("value1")]),
                  new ListValue([new StringValue("value2")]),
                ])
            )
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
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
          expect(program.constants).to.eql([
            new StringValue("varname"),
            new StringValue("key"),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              key: new StringValue("value"),
            })
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("key"),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("var2") })
          );
          variableResolver.register("var2", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("varname"),
            new StringValue("key1"),
            new StringValue("key2"),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              key1: new MapValue({ key2: new StringValue("value") }),
            })
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("varname"),
            new StringValue("key1"),
            new StringValue("key2"),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              key1: new MapValue({ key2: new StringValue("value") }),
            })
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("var2"),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({
              key: new StringValue("value"),
            })
          );
          variableResolver.register("var2", new StringValue("key"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("varname"),
            new StringValue("arbitrary key"),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              "arbitrary key": new StringValue("value"),
            })
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("varname"),
            new ScriptValue(parse("arbitrary key"), "arbitrary key"),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              "arbitrary key": new StringValue("value"),
            })
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("var1"),
            new StringValue("var2"),
            new StringValue("key"),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("value1") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("value2") })
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
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
            new StringValue("var1"),
            new StringValue("var2"),
            new StringValue("key"),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("value1") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("value2") })
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new TupleValue([new StringValue("value2")]),
            ])
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
            new StringValue("var1"),
            new StringValue("var2"),
            new StringValue("key"),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("var3") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("var4") })
          );
          variableResolver.register("var3", new StringValue("value3"));
          variableResolver.register("var4", new StringValue("value4"));
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value3"),
              new StringValue("value4"),
            ])
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
          expect(program.constants).to.eql([
            new StringValue("cmd"),
            new StringValue("key"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () => new MapValue({ key: new StringValue("value") })
            )
          );
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
          expect(program.constants).to.eql([
            new StringValue("cmd"),
            new StringValue("key"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () =>
                new TupleValue([
                  new MapValue({ key: new StringValue("value1") }),
                  new MapValue({ key: new StringValue("value2") }),
                ])
            )
          );
          expect(evaluate(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
        });
      });

      describe("custom selectors", () => {
        beforeEach(() => {
          const lastSelector = {
            apply(value: Value): Value {
              const list = value as ListValue;
              return list.values[list.values.length - 1];
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
          expect(program.constants).to.eql([
            new StringValue("varname"),
            new StringValue("last"),
          ]);

          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          expect(evaluate(program)).to.eql(new StringValue("value3"));
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("last"),
          ]);

          variableResolver.register(
            "var1",
            new ListValue([new StringValue("var2"), new StringValue("var3")])
          );
          variableResolver.register("var3", new StringValue("value"));
          expect(evaluate(program)).to.eql(new StringValue("value"));
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
            new StringValue("var"),
            new StringValue("last"),
            new StringValue("last"),
          ]);

          variableResolver.register(
            "var",
            new ListValue([
              new StringValue("value1"),
              new ListValue([
                new StringValue("value2_1"),
                new StringValue("value2_2"),
              ]),
            ])
          );
          expect(evaluate(program)).to.eql(new StringValue("value2_2"));
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
          expect(program.constants).to.eql([
            new StringValue("var1"),
            new StringValue("var2"),
          ]);

          variableResolver.register(
            "var1",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          variableResolver.register("var2", new StringValue("last"));
          selectorResolver.register(() => ({
            apply(value: Value): Value {
              const list = value as ListValue;
              return list.values[list.values.length - 1];
            },
          }));
          expect(evaluate(program)).to.eql(new StringValue("value3"));
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
          expect(program.constants).to.eql([
            new StringValue("cmd"),
            new StringValue("last"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () =>
                new ListValue([
                  new StringValue("value1"),
                  new StringValue("value2"),
                ])
            )
          );
          expect(evaluate(program)).to.eql(new StringValue("value2"));
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
          expect(program.constants).to.eql([
            new StringValue("varname"),
            new StringValue("cmd"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("index"))
          );
          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("varname"), [
              new IndexedSelector(new StringValue("index")),
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
            new StringValue("varname"),
            new StringValue("key1"),
            new StringValue("key2"),
          ]);

          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("varname"), [
              new KeyedSelector([
                new StringValue("key1"),
                new StringValue("key2"),
              ]),
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
            new StringValue("varname"),
            new StringValue("rule1"),
            new StringValue("arg1"),
            new StringValue("rule2"),
            new StringValue("arg2"),
          ]);

          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("varname"), [
              new GenericSelector([
                new TupleValue([
                  new StringValue("rule1"),
                  new StringValue("arg1"),
                ]),
                new TupleValue([
                  new StringValue("rule2"),
                  new StringValue("arg2"),
                ]),
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
            new StringValue("varname"),
            new StringValue("key1"),
            new StringValue("var1"),
            new StringValue("var2"),
            new StringValue("cmd1"),
            new StringValue("cmd2"),
            new StringValue("var3"),
            new StringValue("key4"),
          ]);

          variableResolver.register("var1", new StringValue("key2"));
          variableResolver.register("var2", new StringValue("rule1"));
          variableResolver.register("var3", new StringValue("cmd3"));
          commandResolver.register(
            "cmd1",
            new FunctionCommand(() => new StringValue("rule2"))
          );
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => new StringValue("index1"))
          );
          commandResolver.register(
            "cmd3",
            new FunctionCommand(() => new StringValue("key3"))
          );
          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("varname"), [
              new KeyedSelector([
                new StringValue("key1"),
                new StringValue("key2"),
              ]),
              new GenericSelector([
                new TupleValue([new StringValue("rule1")]),
                new TupleValue([new StringValue("rule2")]),
              ]),
              new IndexedSelector(new StringValue("index1")),
              new KeyedSelector([
                new StringValue("key3"),
                new StringValue("key4"),
              ]),
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
            new StringValue("varname1"),
            new StringValue("varname2"),
            new StringValue("cmd"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("index"))
          );
          expect(evaluate(program)).to.eql(
            new QualifiedValue(
              new TupleValue([
                new StringValue("varname1"),
                new StringValue("varname2"),
              ]),
              [new IndexedSelector(new StringValue("index"))]
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
            new StringValue("varname1"),
            new StringValue("varname2"),
            new StringValue("key1"),
            new StringValue("key2"),
          ]);

          expect(evaluate(program)).to.eql(
            new QualifiedValue(
              new TupleValue([
                new StringValue("varname1"),
                new StringValue("varname2"),
              ]),
              [
                new KeyedSelector([
                  new StringValue("key1"),
                  new StringValue("key2"),
                ]),
              ]
            )
          );
        });
        specify("generic selector", () => {
          const script = parse("(varname1 varname2){rule1 arg1; rule2 arg2}");
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
            new StringValue("varname1"),
            new StringValue("varname2"),
            new StringValue("rule1"),
            new StringValue("arg1"),
            new StringValue("rule2"),
            new StringValue("arg2"),
          ]);

          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(evaluate(program)).to.eql(
            new QualifiedValue(
              new TupleValue([
                new StringValue("varname1"),
                new StringValue("varname2"),
              ]),
              [
                new GenericSelector([
                  new TupleValue([
                    new StringValue("rule1"),
                    new StringValue("arg1"),
                  ]),
                  new TupleValue([
                    new StringValue("rule2"),
                    new StringValue("arg2"),
                  ]),
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
            new StringValue("varname1"),
            new StringValue("var1"),
            new StringValue("cmd1"),
            new StringValue("key1"),
            new StringValue("var2"),
            new StringValue("var3"),
            new StringValue("var4"),
            new StringValue("cmd2"),
            new StringValue("cmd4"),
          ]);

          variableResolver.register("var1", new StringValue("varname2"));
          variableResolver.register("var2", new StringValue("key2"));
          variableResolver.register("var3", new StringValue("cmd3"));
          variableResolver.register("var4", new StringValue("rule1"));
          commandResolver.register(
            "cmd1",
            new FunctionCommand(() => new StringValue("index1"))
          );
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => new StringValue("rule2"))
          );
          commandResolver.register(
            "cmd3",
            new FunctionCommand(() => new StringValue("key3"))
          );
          commandResolver.register(
            "cmd4",
            new FunctionCommand(() => new StringValue("index2"))
          );
          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(evaluate(program)).to.eql(
            new QualifiedValue(
              new TupleValue([
                new StringValue("varname1"),
                new StringValue("varname2"),
              ]),
              [
                new IndexedSelector(new StringValue("index1")),
                new KeyedSelector([
                  new StringValue("key1"),
                  new StringValue("key2"),
                  new StringValue("key3"),
                ]),
                new GenericSelector([
                  new TupleValue([new StringValue("rule1")]),
                  new TupleValue([new StringValue("rule2")]),
                ]),
                new IndexedSelector(new StringValue("index2")),
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
            new StringValue("source name"),
            new StringValue("cmd"),
          ]);

          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("index"))
          );
          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("source name"), [
              new IndexedSelector(new StringValue("index")),
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
            new StringValue("source name"),
            new StringValue("key1"),
            new StringValue("key2"),
          ]);

          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("source name"), [
              new KeyedSelector([
                new StringValue("key1"),
                new StringValue("key2"),
              ]),
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
            new StringValue("source name"),
            new StringValue("rule1"),
            new StringValue("arg1"),
            new StringValue("rule2"),
            new StringValue("arg2"),
          ]);

          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("source name"), [
              new GenericSelector([
                new TupleValue([
                  new StringValue("rule1"),
                  new StringValue("arg1"),
                ]),
                new TupleValue([
                  new StringValue("rule2"),
                  new StringValue("arg2"),
                ]),
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
            new StringValue("source name"),
            new StringValue("key1"),
            new StringValue("var1"),
            new StringValue("var2"),
            new StringValue("cmd1"),
            new StringValue("cmd2"),
            new StringValue("var3"),
            new StringValue("key4"),
          ]);

          variableResolver.register("var1", new StringValue("key2"));
          variableResolver.register("var2", new StringValue("rule1"));
          variableResolver.register("var3", new StringValue("cmd3"));
          commandResolver.register(
            "cmd1",
            new FunctionCommand(() => new StringValue("rule2"))
          );
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => new StringValue("index1"))
          );
          commandResolver.register(
            "cmd3",
            new FunctionCommand(() => new StringValue("key3"))
          );
          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(evaluate(program)).to.eql(
            new QualifiedValue(new StringValue("source name"), [
              new KeyedSelector([
                new StringValue("key1"),
                new StringValue("key2"),
              ]),
              new GenericSelector([
                new TupleValue([new StringValue("rule1")]),
                new TupleValue([new StringValue("rule2")]),
              ]),
              new IndexedSelector(new StringValue("index1")),
              new KeyedSelector([
                new StringValue("key3"),
                new StringValue("key4"),
              ]),
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
        new StringValue("prefix"),
        new StringValue("var"),
        new StringValue("suffix"),
      ]);

      variableResolver.register(
        "var",
        new TupleValue([new StringValue("value1"), new StringValue("value2")])
      );
      expect(evaluate(program)).to.eql(
        new TupleValue([
          new StringValue("prefix"),
          new StringValue("value1"),
          new StringValue("value2"),
          new StringValue("suffix"),
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
        new StringValue("prefix"),
        new StringValue("cmd"),
        new StringValue("suffix"),
      ]);

      commandResolver.register(
        "cmd",
        new FunctionCommand(
          () =>
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
        )
      );
      expect(evaluate(program)).to.eql(
        new TupleValue([
          new StringValue("prefix"),
          new StringValue("value1"),
          new StringValue("value2"),
          new StringValue("suffix"),
        ])
      );
    });
    describe("scripts", () => {
      beforeEach(() => {
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) => new TupleValue(args))
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
          new StringValue("cmd"),
          new StringValue("var"),
          new StringValue("arg"),
        ]);

        variableResolver.register(
          "var",
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
        );
        expect(evaluate(program)).to.eql(
          new TupleValue([
            new StringValue("cmd"),
            new StringValue("value1"),
            new StringValue("value2"),
            new StringValue("arg"),
          ])
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
          new StringValue("cmd"),
          new StringValue("var1"),
          new StringValue("var2"),
          new StringValue("arg"),
        ]);

        variableResolver.register("var1", new StringValue("value1"));
        variableResolver.register("var2", new StringValue("value2"));
        expect(evaluate(program)).to.eql(
          new TupleValue([
            new StringValue("cmd"),
            new StringValue("value1"),
            new StringValue("value2"),
            new StringValue("arg"),
          ])
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
          new StringValue("cmd"),
          new StringValue("cmd2"),
          new StringValue("arg"),
        ]);

        commandResolver.register(
          "cmd2",
          new FunctionCommand(
            () =>
              new TupleValue([
                new StringValue("value1"),
                new StringValue("value2"),
              ])
          )
        );
        expect(evaluate(program)).to.eql(
          new TupleValue([
            new StringValue("cmd"),
            new StringValue("value1"),
            new StringValue("value2"),
            new StringValue("arg"),
          ])
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
        new StringValue("if"),
        new StringValue("true"),
        new ScriptValue(parse("cmd1 a"), "cmd1 a"),
        new StringValue("else"),
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
        new StringValue("if"),
        new StringValue("false"),
        new ScriptValue(parse("cmd1 a"), "cmd1 a"),
        new StringValue("else"),
        new ScriptValue(parse("cmd2 b"), "cmd2 b"),
      ]);

      commandResolver.register(
        "if",
        new FunctionCommand((args) => {
          const condition = args[1];
          const block = condition.asString() == "true" ? args[2] : args[4];
          const script =
            block.type == ValueType.SCRIPT
              ? (block as ScriptValue).script
              : parse(block.asString());
          const program = compiler.compileScript(script);
          return evaluate(program);
        })
      );
      commandResolver.register("cmd1", new FunctionCommand((args) => args[1]));
      commandResolver.register("cmd2", new FunctionCommand((args) => args[1]));

      expect(evaluate(program1)).to.eql(new StringValue("a"));
      expect(evaluate(program2)).to.eql(new StringValue("b"));
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
        new StringValue("repeat"),
        new StringValue("10"),
        new ScriptValue(parse("cmd foo"), "cmd foo"),
      ]);

      commandResolver.register(
        "repeat",
        new FunctionCommand((args) => {
          const nb = IntegerValue.fromValue(args[1]).value;
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
          return new IntegerValue(counter++);
        })
      );
      expect(evaluate(program)).to.eql(new IntegerValue(9));
      expect(counter).to.eql(10);
      expect(acc).to.eql("foo".repeat(10));
    });
  });

  describe("ExecutionContext", () => {
    it("should resume execution", () => {
      const script = parse("break 1; ok 2; break 3; break 4; ok 5; break 6");
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
      const context = new ExecutionContext();
      expect(executor.execute(program, context)).to.eql(
        BREAK(new StringValue("1"))
      );
      expect(executor.execute(program, context)).to.eql(
        BREAK(new StringValue("3"))
      );
      expect(executor.execute(program, context)).to.eql(
        BREAK(new StringValue("4"))
      );
      expect(executor.execute(program, context)).to.eql(
        BREAK(new StringValue("6"))
      );
      expect(executor.execute(program, context)).to.eql(
        OK(new StringValue("6"))
      );
    });
    it("should support setting result", () => {
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
      const context = new ExecutionContext();
      expect(executor.execute(program, context)).to.eql(
        BREAK(new StringValue("1"))
      );
      context.result = OK(new StringValue("2"));
      expect(executor.execute(program, context)).to.eql(
        OK(new StringValue("2"))
      );
    });
    it("should support resumable commands", () => {
      const script = parse("ok [cmd]");
      const program = compiler.compileScript(script);

      commandResolver.register("cmd", {
        execute(_args) {
          return YIELD(new IntegerValue(1));
        },
        resume(value) {
          const i = (value as IntegerValue).value;
          if (i == 5) return OK(new StringValue("done"));
          return YIELD(new IntegerValue(i + 1));
        },
      });
      commandResolver.register("ok", {
        execute(args) {
          return OK(args[1]);
        },
      });

      const context = new ExecutionContext();
      expect(executor.execute(program, context)).to.eql(
        YIELD(new IntegerValue(1))
      );
      expect(executor.execute(program, context)).to.eql(
        YIELD(new IntegerValue(2))
      );
      expect(executor.execute(program, context)).to.eql(
        YIELD(new IntegerValue(3))
      );
      expect(executor.execute(program, context)).to.eql(
        YIELD(new IntegerValue(4))
      );
      expect(executor.execute(program, context)).to.eql(
        YIELD(new IntegerValue(5))
      );
      expect(executor.execute(program, context)).to.eql(
        OK(new StringValue("done"))
      );
    });
  });
});
