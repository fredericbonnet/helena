import { expect } from "chai";
import { cpuUsage } from "process";
import { Command } from "./command";
import {
  Compiler,
  Context,
  PushValue,
  OpenFrame,
  CloseFrame,
  ResolveValue,
  SetSource,
  SelectIndex,
  SelectKeys,
  EvaluateSentence,
  SubstituteResult,
  JoinStrings,
  SelectRules,
  ExpandValue,
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
  evaluate(args: Value[]): Value {
    return args[0];
  }
}
const INT_CMD = new IntCommand();
class MockCommandResolver implements CommandResolver {
  resolve(name: string): Command {
    if (!isNaN(parseInt(name))) return INT_CMD;
    return this.commands.get(name);
  }

  commands: Map<string, Command> = new Map();
  register(name: string, command: Command) {
    this.commands.set(name, command);
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
  let context: Context;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const compileFirstWord = (script: Script) =>
    compiler.compileWord(script.sentences[0].words[0]);

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    compiler = new Compiler();
    variableResolver = new MockVariableResolver();
    commandResolver = new MockCommandResolver();
    selectorResolver = new MockSelectorResolver();
    context = new Context(variableResolver, commandResolver, selectorResolver);
  });

  describe("words", () => {
    describe("roots", () => {
      specify("literal", () => {
        const script = parse("word");
        const program = compileFirstWord(script);
        expect(program).to.eql([new PushValue(new StringValue("word"))]);

        expect(context.execute(program)).to.eql(new StringValue("word"));
      });

      describe("tuples", () => {
        specify("empty tuple", () => {
          const script = parse("()");
          const program = compileFirstWord(script);
          expect(program).to.eql([new OpenFrame(), new CloseFrame()]);

          expect(context.execute(program)).to.eql(new TupleValue([]));
        });
        specify("tuple with literals", () => {
          const script = parse("( lit1 lit2 )");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("lit1")),
            new PushValue(new StringValue("lit2")),
            new CloseFrame(),
          ]);

          expect(context.execute(program)).to.eql(
            new TupleValue([new StringValue("lit1"), new StringValue("lit2")])
          );
        });
        specify("complex case", () => {
          const script = parse('( this [cmd] $var1 "complex" ${var2}(key) )');
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("this")),
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("complex")),
            new CloseFrame(),
            new JoinStrings(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
            new CloseFrame(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("is"),
          });
          variableResolver.register("var1", new StringValue("a"));
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("tuple") })
          );
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([new PushValue(value)]);

          expect(context.execute(program)).to.eql(value);
        });
        specify("block with literals", () => {
          const source = " lit1 lit2 ";
          const script = parse(`{${source}}`);
          const value = new ScriptValue(parse(source), source);
          const program = compileFirstWord(script);
          expect(program).to.eql([new PushValue(value)]);

          expect(context.execute(program)).to.eql(value);
        });
        specify("complex case", () => {
          const source = ' this [cmd] $var1 "complex" ${var2}(key) ';
          const script = parse(`{${source}}`);
          const block = script.sentences[0].words[0]
            .morphemes[0] as BlockMorpheme;
          const value = new ScriptValue(block.subscript, source);
          const program = compileFirstWord(script);
          expect(program).to.eql([new PushValue(value)]);

          expect(context.execute(program)).to.eql(value);
        });
      });

      describe("expressions", () => {
        specify("empty expression", () => {
          const script = parse("[]");
          const program = compileFirstWord(script);
          expect(program).to.eql([new SubstituteResult()]);

          expect(context.execute(program)).to.eql(NIL);
        });
        specify("expression with literals", () => {
          const script = parse("[ cmd arg ]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new PushValue(new StringValue("arg")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
          ]);

          commandResolver.register("cmd", {
            evaluate: (args) =>
              new TupleValue([...args, new StringValue("foo")]),
          });
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("this")),
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("complex")),
            new CloseFrame(),
            new JoinStrings(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("is"),
          });
          variableResolver.register("var1", new StringValue("a"));
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("expression") })
          );
          commandResolver.register("this", {
            evaluate: (args) => new TupleValue(args),
          });
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new OpenFrame(),
            new CloseFrame(),
            new JoinStrings(),
          ]);

          expect(context.execute(program)).to.eql(new StringValue(""));
        });
        specify("simple string", () => {
          const script = parse('"this is a string"');
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("this is a string")),
            new CloseFrame(),
            new JoinStrings(),
          ]);

          expect(context.execute(program)).to.eql(
            new StringValue("this is a string")
          );
        });

        describe("expressions", () => {
          specify("simple command", () => {
            const script = parse('"this [cmd] a string"');
            const program = compileFirstWord(script);
            expect(program).to.eql([
              new OpenFrame(),
              new PushValue(new StringValue("this ")),
              new OpenFrame(),
              new PushValue(new StringValue("cmd")),
              new CloseFrame(),
              new EvaluateSentence(),
              new SubstituteResult(),
              new PushValue(new StringValue(" a string")),
              new CloseFrame(),
              new JoinStrings(),
            ]);

            commandResolver.register("cmd", {
              evaluate: () => new StringValue("is"),
            });
            expect(context.execute(program)).to.eql(
              new StringValue("this is a string")
            );
          });
          specify("multiple commands", () => {
            const script = parse('"this [cmd1][cmd2] a string"');
            const program = compileFirstWord(script);
            expect(program).to.eql([
              new OpenFrame(),
              new PushValue(new StringValue("this ")),
              new OpenFrame(),
              new PushValue(new StringValue("cmd1")),
              new CloseFrame(),
              new EvaluateSentence(),
              new SubstituteResult(),
              new OpenFrame(),
              new PushValue(new StringValue("cmd2")),
              new CloseFrame(),
              new EvaluateSentence(),
              new SubstituteResult(),
              new PushValue(new StringValue(" a string")),
              new CloseFrame(),
              new JoinStrings(),
            ]);

            commandResolver.register("cmd1", {
              evaluate: () => new StringValue("i"),
            });
            commandResolver.register("cmd2", {
              evaluate: () => new StringValue("s"),
            });
            expect(context.execute(program)).to.eql(
              new StringValue("this is a string")
            );
          });
        });

        specify("string with multiple substitutions", () => {
          const script = parse(
            '"this $var1 ${variable 2} [cmd1] with subst[cmd2]${var3}[cmd3]$var4"'
          );
          const program = compileFirstWord(script);

          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("this ")),
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new PushValue(new StringValue(" ")),
            new PushValue(new StringValue("variable 2")),
            new ResolveValue(),
            new PushValue(new StringValue(" ")),
            new OpenFrame(),
            new PushValue(new StringValue("cmd1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushValue(new StringValue(" with subst")),
            new OpenFrame(),
            new PushValue(new StringValue("cmd2")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushValue(new StringValue("var3")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd3")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
            new PushValue(new StringValue("var4")),
            new ResolveValue(),
            new CloseFrame(),
            new JoinStrings(),
          ]);

          variableResolver.register("var1", new StringValue("is"));
          variableResolver.register("variable 2", new StringValue("a"));
          commandResolver.register("cmd1", {
            evaluate: () => new StringValue("string"),
          });
          commandResolver.register("cmd2", {
            evaluate: () => new StringValue("it"),
          });
          variableResolver.register(
            "var3",
            new ListValue([new StringValue("foo"), new StringValue("ut")])
          );
          commandResolver.register("cmd3", {
            evaluate: () => new IntegerValue(1),
          });
          variableResolver.register("var4", new StringValue("ions"));
          expect(context.execute(program)).to.eql(
            new StringValue("this is a string with substitutions")
          );
        });
      });

      specify("here-strings", () => {
        const script = parse('"""this is a "\'\\ $ \nhere-string"""');
        const program = compileFirstWord(script);
        expect(program).to.eql([
          new PushValue(new StringValue("this is a \"'\\ $ \nhere-string")),
        ]);

        expect(context.execute(program)).to.eql(
          new StringValue("this is a \"'\\ $ \nhere-string")
        );
      });

      specify("tagged strings", () => {
        const script = parse(
          '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
        );
        const program = compileFirstWord(script);
        expect(program).to.eql([
          new PushValue(
            new StringValue("this is \n a \n \"'\\ $ tagged string\n")
          ),
        ]);

        expect(context.execute(program)).to.eql(
          new StringValue("this is \n a \n \"'\\ $ tagged string\n")
        );
      });
    });

    describe("compounds", () => {
      specify("literal prefix", () => {
        const script = parse("this_${var}(key)_a_[cmd a b]_compound");
        const program = compileFirstWord(script);
        expect(program).to.eql([
          new OpenFrame(),
          new PushValue(new StringValue("this_")),
          new PushValue(new StringValue("var")),
          new ResolveValue(),
          new OpenFrame(),
          new PushValue(new StringValue("key")),
          new CloseFrame(),
          new SelectKeys(),
          new PushValue(new StringValue("_a_")),
          new OpenFrame(),
          new PushValue(new StringValue("cmd")),
          new PushValue(new StringValue("a")),
          new PushValue(new StringValue("b")),
          new CloseFrame(),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushValue(new StringValue("_compound")),
          new CloseFrame(),
          new JoinStrings(),
        ]);

        variableResolver.register(
          "var",
          new MapValue({ key: new StringValue("is") })
        );
        commandResolver.register("cmd", {
          evaluate: () => new StringValue("literal-prefixed"),
        });
        expect(context.execute(program)).to.eql(
          new StringValue("this_is_a_literal-prefixed_compound")
        );
      });
      specify("expression prefix", () => {
        const script = parse("[cmd a b]_is_an_${var}(key)_compound");
        const program = compileFirstWord(script);
        expect(program).to.eql([
          new OpenFrame(),
          new OpenFrame(),
          new PushValue(new StringValue("cmd")),
          new PushValue(new StringValue("a")),
          new PushValue(new StringValue("b")),
          new CloseFrame(),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushValue(new StringValue("_is_an_")),
          new PushValue(new StringValue("var")),
          new ResolveValue(),
          new OpenFrame(),
          new PushValue(new StringValue("key")),
          new CloseFrame(),
          new SelectKeys(),
          new PushValue(new StringValue("_compound")),
          new CloseFrame(),
          new JoinStrings(),
        ]);

        commandResolver.register("cmd", {
          evaluate: () => new StringValue("this"),
        });
        variableResolver.register(
          "var",
          new MapValue({ key: new StringValue("expression-prefixed") })
        );
        expect(context.execute(program)).to.eql(
          new StringValue("this_is_an_expression-prefixed_compound")
        );
      });
      specify("substitution prefix", () => {
        const script = parse("${var}(key)_is_a_[cmd a b]_compound");
        const program = compileFirstWord(script);
        expect(program).to.eql([
          new OpenFrame(),
          new PushValue(new StringValue("var")),
          new ResolveValue(),
          new OpenFrame(),
          new PushValue(new StringValue("key")),
          new CloseFrame(),
          new SelectKeys(),
          new PushValue(new StringValue("_is_a_")),
          new OpenFrame(),
          new PushValue(new StringValue("cmd")),
          new PushValue(new StringValue("a")),
          new PushValue(new StringValue("b")),
          new CloseFrame(),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushValue(new StringValue("_compound")),
          new CloseFrame(),
          new JoinStrings(),
        ]);

        variableResolver.register(
          "var",
          new MapValue({ key: new StringValue("this") })
        );
        commandResolver.register("cmd", {
          evaluate: () => new StringValue("substitution-prefixed"),
        });
        expect(context.execute(program)).to.eql(
          new StringValue("this_is_a_substitution-prefixed_compound")
        );
      });
    });

    describe("substitutions", () => {
      describe("scalars", () => {
        specify("simple substitution", () => {
          const script = parse("$varname");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
          ]);

          variableResolver.register("varname", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("double substitution", () => {
          const script = parse("$$var1");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new ResolveValue(),
          ]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("triple substitution", () => {
          const script = parse("$$$var1");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new ResolveValue(),
            new ResolveValue(),
          ]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("var3"));
          variableResolver.register("var3", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
      });

      describe("tuples", () => {
        specify("single variable", () => {
          const script = parse("$(varname)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("varname")),
            new CloseFrame(),
            new ResolveValue(),
          ]);

          variableResolver.register("varname", new StringValue("value"));
          expect(context.execute(program)).to.eql(
            new TupleValue([new StringValue("value")])
          );
        });
        specify("multiple variables", () => {
          const script = parse("$(var1 var2)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new PushValue(new StringValue("var2")),
            new CloseFrame(),
            new ResolveValue(),
          ]);

          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          expect(context.execute(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
        });
        specify("double substitution", () => {
          const script = parse("$$(var1)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new CloseFrame(),
            new ResolveValue(),
            new ResolveValue(),
          ]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          expect(context.execute(program)).to.eql(
            new TupleValue([new StringValue("value")])
          );
        });
        specify("nested tuples", () => {
          const script = parse("$(var1 (var2))");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new CloseFrame(),
            new CloseFrame(),
            new ResolveValue(),
          ]);

          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          expect(context.execute(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new TupleValue([new StringValue("value2")]),
            ])
          );
        });
        specify("nested double substitution", () => {
          const script = parse("$$((var1))");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new CloseFrame(),
            new CloseFrame(),
            new ResolveValue(),
            new ResolveValue(),
          ]);

          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          expect(context.execute(program)).to.eql(
            new TupleValue([new TupleValue([new StringValue("value")])])
          );
        });
      });

      describe("blocks", () => {
        specify("varname with spaces", () => {
          const script = parse("${variable name}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("variable name")),
            new ResolveValue(),
          ]);

          variableResolver.register("variable name", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("varname with special characters", () => {
          const script = parse('${variable " " name}');
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue('variable " " name')),
            new ResolveValue(),
          ]);

          variableResolver.register(
            'variable " " name',
            new StringValue("value")
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("varname with continuations", () => {
          const script = parse("${variable\\\n \t\r     name}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("variable name")),
            new ResolveValue(),
          ]);

          variableResolver.register("variable name", new StringValue("value"));
          variableResolver.register(
            'variable " " name',
            new StringValue("value")
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
      });

      describe("expressions", () => {
        specify("simple substitution", () => {
          const script = parse("$[cmd]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () =>
              new ListValue([
                new StringValue("value1"),
                new StringValue("value2"),
              ]),
          });
          expect(context.execute(program)).to.eql(
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
        });
        specify("double substitution, scalar", () => {
          const script = parse("$$[cmd]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new ResolveValue(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("var"),
          });
          variableResolver.register("var", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("double substitution, tuple", () => {
          const script = parse("$$[cmd]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new ResolveValue(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () =>
              new TupleValue([
                new StringValue("var1"),
                new StringValue("var2"),
              ]),
          });
          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          expect(context.execute(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
        });
        specify("two sentences", () => {
          const script = parse("[cmd1 result1; cmd2 result2]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd1")),
            new PushValue(new StringValue("result1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd2")),
            new PushValue(new StringValue("result2")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
          ]);

          let called = {};
          let fn: Command = {
            evaluate: (args) => {
              const cmd = args[0].asString();
              called[cmd] = called[cmd] ?? 0 + 1;
              return args[1];
            },
          };
          commandResolver.register("cmd1", fn);
          commandResolver.register("cmd2", fn);
          expect(context.execute(program)).to.eql(new StringValue("result2"));
          expect(called).to.eql({ cmd1: 1, cmd2: 1 });
        });
        specify("indirect command", () => {
          const script = parse("[$cmdname]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmdname")),
            new ResolveValue(),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
          ]);

          variableResolver.register("cmdname", new StringValue("cmd"));
          commandResolver.register("cmd", {
            evaluate: () => new StringValue("value"),
          });
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
      });

      describe("indexed selectors", () => {
        specify("simple substitution", () => {
          const script = parse("$varname[1]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
          expect(context.execute(program)).to.eql(new StringValue("value2"));
        });
        specify("double substitution", () => {
          const script = parse("$$var1[0]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("0")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
            new ResolveValue(),
          ]);

          variableResolver.register(
            "var1",
            new ListValue([new StringValue("var2")])
          );
          variableResolver.register("var2", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("successive indexes", () => {
          const script = parse("$varname[1][0]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
            new OpenFrame(),
            new PushValue(new StringValue("0")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
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
          expect(context.execute(program)).to.eql(new StringValue("value2_1"));
        });
        specify("indirect index", () => {
          const script = parse("$var1[$var2]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
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
          expect(context.execute(program)).to.eql(new StringValue("value2"));
        });
        specify("command index", () => {
          const script = parse("$varname[cmd]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("1"),
          });
          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          expect(context.execute(program)).to.eql(new StringValue("value2"));
        });
        specify("scalar expression", () => {
          const script = parse("$[cmd][0]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new OpenFrame(),
            new PushValue(new StringValue("0")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new ListValue([new StringValue("value")]),
          });
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("tuple expression", () => {
          const script = parse("$[cmd][0]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new OpenFrame(),
            new PushValue(new StringValue("0")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () =>
              new TupleValue([
                new ListValue([new StringValue("value1")]),
                new ListValue([new StringValue("value2")]),
              ]),
          });
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              key: new StringValue("value"),
            })
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("double substitution", () => {
          const script = parse("$$var1(key)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
            new ResolveValue(),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("var2") })
          );
          variableResolver.register("var2", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("recursive keys", () => {
          const script = parse("$varname(key1 key2)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("key2")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              key1: new MapValue({ key2: new StringValue("value") }),
            })
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("successive keys", () => {
          const script = parse("$varname(key1)(key2)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new PushValue(new StringValue("key2")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              key1: new MapValue({ key2: new StringValue("value") }),
            })
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("indirect key", () => {
          const script = parse("$var1($var2)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({
              key: new StringValue("value"),
            })
          );
          variableResolver.register("var2", new StringValue("key"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("string key", () => {
          const script = parse('$varname("arbitrary key")');
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("arbitrary key")),
            new CloseFrame(),
            new JoinStrings(),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              "arbitrary key": new StringValue("value"),
            })
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("block key", () => {
          const script = parse("$varname({arbitrary key})");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(
              new ScriptValue(parse("arbitrary key"), "arbitrary key")
            ),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "varname",
            new MapValue({
              "arbitrary key": new StringValue("value"),
            })
          );
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("tuple", () => {
          const script = parse("$(var1 var2)(key)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new PushValue(new StringValue("var2")),
            new CloseFrame(),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("value1") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("value2") })
          );
          expect(context.execute(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ])
          );
        });
        specify("recursive tuple", () => {
          const script = parse("$(var1 (var2))(key)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new CloseFrame(),
            new CloseFrame(),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("value1") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("value2") })
          );
          expect(context.execute(program)).to.eql(
            new TupleValue([
              new StringValue("value1"),
              new TupleValue([new StringValue("value2")]),
            ])
          );
        });
        specify("tuple with double substitution", () => {
          const script = parse("$$(var1 var2)(key)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("var1")),
            new PushValue(new StringValue("var2")),
            new CloseFrame(),
            new ResolveValue(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
            new ResolveValue(),
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
          expect(context.execute(program)).to.eql(
            new TupleValue([
              new StringValue("value3"),
              new StringValue("value4"),
            ])
          );
        });
        specify("scalar expression", () => {
          const script = parse("$[cmd](key)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new MapValue({ key: new StringValue("value") }),
          });
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("tuple expression", () => {
          const script = parse("$[cmd](key)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new OpenFrame(),
            new PushValue(new StringValue("key")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () =>
              new TupleValue([
                new MapValue({ key: new StringValue("value1") }),
                new MapValue({ key: new StringValue("value2") }),
              ]),
          });
          expect(context.execute(program)).to.eql(
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
          selectorResolver.register((rules) => lastSelector);
        });
        specify("simple substitution", () => {
          const script = parse("$varname{last}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new ResolveValue(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("last")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
          ]);

          variableResolver.register(
            "varname",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          expect(context.execute(program)).to.eql(new StringValue("value3"));
        });
        specify("double substitution", () => {
          const script = parse("$$var1{last}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("last")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
            new ResolveValue(),
          ]);

          variableResolver.register(
            "var1",
            new ListValue([new StringValue("var2"), new StringValue("var3")])
          );
          variableResolver.register("var3", new StringValue("value"));
          expect(context.execute(program)).to.eql(new StringValue("value"));
        });
        specify("successive selectors", () => {
          const script = parse("$var{last}{last}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var")),
            new ResolveValue(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("last")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("last")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
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
          expect(context.execute(program)).to.eql(new StringValue("value2_2"));
        });
        specify("indirect selector", () => {
          const script = parse("$var1{$var2}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
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
          selectorResolver.register((rules) => ({
            apply(value: Value): Value {
              const list = value as ListValue;
              return list.values[list.values.length - 1];
            },
          }));
          expect(context.execute(program)).to.eql(new StringValue("value3"));
        });
        specify("expression", () => {
          const script = parse("$[cmd]{last}");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("last")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () =>
              new ListValue([
                new StringValue("value1"),
                new StringValue("value2"),
              ]),
          });
          expect(context.execute(program)).to.eql(new StringValue("value2"));
        });
      });
    });

    describe("qualified words", () => {
      describe("literal prefix", () => {
        specify("indexed selector", () => {
          const script = parse("varname[cmd]");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("index"),
          });
          expect(context.execute(program)).to.eql(
            new QualifiedValue(new StringValue("varname"), [
              new IndexedSelector(new StringValue("index")),
            ])
          );
        });
        specify("keyed selector", () => {
          const script = parse("varname(key1 key2)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("key2")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new SetSource(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("rule1")),
            new PushValue(new StringValue("arg1")),
            new CloseFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("rule2")),
            new PushValue(new StringValue("arg2")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
          ]);

          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new PushValue(new StringValue("varname")),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new CloseFrame(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd2")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var3")),
            new ResolveValue(),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new PushValue(new StringValue("key4")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register("var1", new StringValue("key2"));
          variableResolver.register("var2", new StringValue("rule1"));
          variableResolver.register("var3", new StringValue("cmd3"));
          commandResolver.register("cmd1", {
            evaluate: () => new StringValue("rule2"),
          });
          commandResolver.register("cmd2", {
            evaluate: () => new StringValue("index1"),
          });
          commandResolver.register("cmd3", {
            evaluate: () => new StringValue("key3"),
          });
          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("varname1")),
            new PushValue(new StringValue("varname2")),
            new CloseFrame(),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("index"),
          });
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("varname1")),
            new PushValue(new StringValue("varname2")),
            new CloseFrame(),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("key2")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("varname1")),
            new PushValue(new StringValue("varname2")),
            new CloseFrame(),
            new SetSource(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("rule1")),
            new PushValue(new StringValue("arg1")),
            new CloseFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("rule2")),
            new PushValue(new StringValue("arg2")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
          ]);

          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new OpenFrame(),
            new PushValue(new StringValue("varname1")),
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new CloseFrame(),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var3")),
            new ResolveValue(),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var4")),
            new ResolveValue(),
            new CloseFrame(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd2")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd4")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          variableResolver.register("var1", new StringValue("varname2"));
          variableResolver.register("var2", new StringValue("key2"));
          variableResolver.register("var3", new StringValue("cmd3"));
          variableResolver.register("var4", new StringValue("rule1"));
          commandResolver.register("cmd1", {
            evaluate: () => new StringValue("index1"),
          });
          commandResolver.register("cmd2", {
            evaluate: () => new StringValue("rule2"),
          });
          commandResolver.register("cmd3", {
            evaluate: () => new StringValue("key3"),
          });
          commandResolver.register("cmd4", {
            evaluate: () => new StringValue("index2"),
          });
          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new PushValue(new StringValue("source name")),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
          ]);

          commandResolver.register("cmd", {
            evaluate: () => new StringValue("index"),
          });
          expect(context.execute(program)).to.eql(
            new QualifiedValue(new StringValue("source name"), [
              new IndexedSelector(new StringValue("index")),
            ])
          );
        });
        specify("keyed selector", () => {
          const script = parse("{source name}(key1 key2)");
          const program = compileFirstWord(script);
          expect(program).to.eql([
            new PushValue(new StringValue("source name")),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("key2")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new PushValue(new StringValue("source name")),
            new SetSource(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("rule1")),
            new PushValue(new StringValue("arg1")),
            new CloseFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("rule2")),
            new PushValue(new StringValue("arg2")),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
          ]);

          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(context.execute(program)).to.eql(
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
          expect(program).to.eql([
            new PushValue(new StringValue("source name")),
            new SetSource(),
            new OpenFrame(),
            new PushValue(new StringValue("key1")),
            new PushValue(new StringValue("var1")),
            new ResolveValue(),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var2")),
            new ResolveValue(),
            new CloseFrame(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd1")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new CloseFrame(),
            new CloseFrame(),
            new SelectRules(),
            new OpenFrame(),
            new PushValue(new StringValue("cmd2")),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new SelectIndex(),
            new OpenFrame(),
            new OpenFrame(),
            new PushValue(new StringValue("var3")),
            new ResolveValue(),
            new CloseFrame(),
            new EvaluateSentence(),
            new SubstituteResult(),
            new CloseFrame(),
            new SelectKeys(),
            new OpenFrame(),
            new PushValue(new StringValue("key4")),
            new CloseFrame(),
            new SelectKeys(),
          ]);

          variableResolver.register("var1", new StringValue("key2"));
          variableResolver.register("var2", new StringValue("rule1"));
          variableResolver.register("var3", new StringValue("cmd3"));
          commandResolver.register("cmd1", {
            evaluate: () => new StringValue("rule2"),
          });
          commandResolver.register("cmd2", {
            evaluate: () => new StringValue("index1"),
          });
          commandResolver.register("cmd3", {
            evaluate: () => new StringValue("key3"),
          });
          selectorResolver.register((rules) => new GenericSelector(rules));
          expect(context.execute(program)).to.eql(
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
        expect(program).to.eql([]);
      });

      specify("block comments", () => {
        const script = parse("##{ this \n ; is$ (a  \n#{comment{[( }##");
        const program = compileFirstWord(script);
        expect(program).to.eql([]);
      });
    });
  });

  describe("word expansion", () => {
    specify("tuples", () => {
      const script = parse("(prefix $*var suffix)");
      const program = compileFirstWord(script);
      expect(program).to.eql([
        new OpenFrame(),
        new PushValue(new StringValue("prefix")),
        new PushValue(new StringValue("var")),
        new ResolveValue(),
        new ExpandValue(),
        new PushValue(new StringValue("suffix")),
        new CloseFrame(),
      ]);

      variableResolver.register(
        "var",
        new TupleValue([new StringValue("value1"), new StringValue("value2")])
      );
      expect(context.execute(program)).to.eql(
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
      expect(program).to.eql([
        new OpenFrame(),
        new PushValue(new StringValue("prefix")),
        new OpenFrame(),
        new PushValue(new StringValue("cmd")),
        new CloseFrame(),
        new EvaluateSentence(),
        new SubstituteResult(),
        new ExpandValue(),
        new PushValue(new StringValue("suffix")),
        new CloseFrame(),
      ]);

      commandResolver.register("cmd", {
        evaluate: (args) =>
          new TupleValue([
            new StringValue("value1"),
            new StringValue("value2"),
          ]),
      });
      expect(context.execute(program)).to.eql(
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
        commandResolver.register("cmd", {
          evaluate: (args) => new TupleValue(args),
        });
      });
      specify("single variable", () => {
        const script = parse("cmd $*var arg");
        const program = compiler.compileScript(script);
        expect(program).to.eql([
          new OpenFrame(),
          new PushValue(new StringValue("cmd")),
          new PushValue(new StringValue("var")),
          new ResolveValue(),
          new ExpandValue(),
          new PushValue(new StringValue("arg")),
          new CloseFrame(),
          new EvaluateSentence(),
        ]);

        variableResolver.register(
          "var",
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
        );
        expect(context.execute([...program, new SubstituteResult()])).to.eql(
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
        expect(program).to.eql([
          new OpenFrame(),
          new PushValue(new StringValue("cmd")),
          new OpenFrame(),
          new PushValue(new StringValue("var1")),
          new PushValue(new StringValue("var2")),
          new CloseFrame(),
          new ResolveValue(),
          new ExpandValue(),
          new PushValue(new StringValue("arg")),
          new CloseFrame(),
          new EvaluateSentence(),
        ]);

        variableResolver.register("var1", new StringValue("value1"));
        variableResolver.register("var2", new StringValue("value2"));
        expect(context.execute([...program, new SubstituteResult()])).to.eql(
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
        expect(program).to.eql([
          new OpenFrame(),
          new PushValue(new StringValue("cmd")),
          new OpenFrame(),
          new PushValue(new StringValue("cmd2")),
          new CloseFrame(),
          new EvaluateSentence(),
          new SubstituteResult(),
          new ExpandValue(),
          new PushValue(new StringValue("arg")),
          new CloseFrame(),
          new EvaluateSentence(),
        ]);

        commandResolver.register("cmd2", {
          evaluate: (args) =>
            new TupleValue([
              new StringValue("value1"),
              new StringValue("value2"),
            ]),
        });
        expect(context.execute([...program, new SubstituteResult()])).to.eql(
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
      expect(program).to.eql([]);
    });
    specify("conditional evaluation", () => {
      const script1 = parse("if true {cmd1 a} else {cmd2 b}");
      const program1 = compiler.compileScript(script1);
      expect(program1).to.eql([
        new OpenFrame(),
        new PushValue(new StringValue("if")),
        new PushValue(new StringValue("true")),
        new PushValue(new ScriptValue(parse("cmd1 a"), "cmd1 a")),
        new PushValue(new StringValue("else")),
        new PushValue(new ScriptValue(parse("cmd2 b"), "cmd2 b")),
        new CloseFrame(),
        new EvaluateSentence(),
      ]);

      const script2 = parse("if false {cmd1 a} else {cmd2 b}");
      const program2 = compiler.compileScript(script2);
      expect(program2).to.eql([
        new OpenFrame(),
        new PushValue(new StringValue("if")),
        new PushValue(new StringValue("false")),
        new PushValue(new ScriptValue(parse("cmd1 a"), "cmd1 a")),
        new PushValue(new StringValue("else")),
        new PushValue(new ScriptValue(parse("cmd2 b"), "cmd2 b")),
        new CloseFrame(),
        new EvaluateSentence(),
      ]);

      commandResolver.register("if", {
        evaluate: (args) => {
          const condition = args[1];
          const block = condition.asString() == "true" ? args[2] : args[4];
          const script =
            block.type == ValueType.SCRIPT
              ? (block as ScriptValue).script
              : parse(block.asString());
          const program = compiler.compileScript(script);
          return context.execute([...program, new SubstituteResult()]);
        },
      });
      commandResolver.register("cmd1", {
        evaluate: (args) => args[1],
      });
      commandResolver.register("cmd2", {
        evaluate: (args) => args[1],
      });

      expect(context.execute([...program1, new SubstituteResult()])).to.eql(
        new StringValue("a")
      );
      expect(context.execute([...program2, new SubstituteResult()])).to.eql(
        new StringValue("b")
      );
    });

    specify("loop", () => {
      const script = parse("repeat 10 {cmd foo}");
      const program = compiler.compileScript(script);
      expect(program).to.eql([
        new OpenFrame(),
        new PushValue(new StringValue("repeat")),
        new PushValue(new StringValue("10")),
        new PushValue(new ScriptValue(parse("cmd foo"), "cmd foo")),
        new CloseFrame(),
        new EvaluateSentence(),
      ]);

      commandResolver.register("repeat", {
        evaluate: (args) => {
          const nb = IntegerValue.fromValue(args[1]).value;
          const block = args[2];
          const script =
            block.type == ValueType.SCRIPT
              ? (block as ScriptValue).script
              : parse(block.asString());
          const program = compiler.compileScript(script);
          let value = NIL;
          for (let i = 0; i < nb; i++) {
            value = context.execute([...program, new SubstituteResult()]);
          }
          return value;
        },
      });
      let counter = 0;
      let acc = "";
      commandResolver.register("cmd", {
        evaluate: (args) => {
          const value = args[1].asString();
          acc += value;
          return new IntegerValue(counter++);
        },
      });
      expect(context.execute([...program, new SubstituteResult()])).to.eql(
        new IntegerValue(9)
      );
      expect(counter).to.eql(10);
      expect(acc).to.eql("foo".repeat(10));
    });
  });
});
