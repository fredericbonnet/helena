import { expect } from "chai";
import { cpuUsage } from "process";
import { Command } from "./command";
import {
  Compiler,
  Context,
  PushLiteral,
  PushTuple,
  ResolveValue,
  SelectIndex,
  SelectKeys,
  EvaluateSentence,
  SubstituteResult,
  JoinStrings,
} from "./compiler";
import { VariableResolver, CommandResolver } from "./evaluator";
import { Parser } from "./parser";
import { Script } from "./syntax";
import { Tokenizer } from "./tokenizer";
import {
  IntegerValue,
  ListValue,
  MapValue,
  NIL,
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

describe("Compiler", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let variableResolver: MockVariableResolver;
  let commandResolver: MockCommandResolver;
  let compiler: Compiler;
  let context: Context;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));
  const compileFirstSentence = (script: Script) =>
    compiler.compileSentence(script.sentences[0]);

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    compiler = new Compiler();
    variableResolver = new MockVariableResolver();
    commandResolver = new MockCommandResolver();
    context = new Context(variableResolver, commandResolver);
  });

  specify("literal", () => {
    const script = parse("word");
    const program = compileFirstSentence(script);
    expect(program).to.eql([new PushLiteral(new StringValue("word"))]);

    expect(context.execute(program)).to.eql(new StringValue("word"));
  });

  describe("strings", () => {
    specify("empty string", () => {
      const script = parse('""');
      const program = compileFirstSentence(script);
      expect(program).to.eql([new PushTuple([]), new JoinStrings()]);

      expect(context.execute(program)).to.eql(new StringValue(""));
    });
    specify("simple string", () => {
      const script = parse('"this is a string"');
      const program = compileFirstSentence(script);
      expect(program).to.eql([
        new PushTuple([new PushLiteral(new StringValue("this is a string"))]),
        new JoinStrings(),
      ]);

      expect(context.execute(program)).to.eql(
        new StringValue("this is a string")
      );
    });

    describe("expressions", () => {
      specify("simple command", () => {
        const script = parse('"this [cmd] a string"');
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("this ")),
            new PushTuple([new PushLiteral(new StringValue("cmd"))]),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushLiteral(new StringValue(" a string")),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("this ")),
            new PushTuple([new PushLiteral(new StringValue("cmd1"))]),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushTuple([new PushLiteral(new StringValue("cmd2"))]),
            new EvaluateSentence(),
            new SubstituteResult(),
            new PushLiteral(new StringValue(" a string")),
          ]),
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
      const program = compileFirstSentence(script);

      expect(program).to.eql([
        new PushTuple([
          new PushLiteral(new StringValue("this ")),
          new PushLiteral(new StringValue("var1")),
          new ResolveValue(),
          new PushLiteral(new StringValue(" ")),
          new PushLiteral(new StringValue("variable 2")),
          new ResolveValue(),
          new PushLiteral(new StringValue(" ")),
          new PushTuple([new PushLiteral(new StringValue("cmd1"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushLiteral(new StringValue(" with subst")),
          new PushTuple([new PushLiteral(new StringValue("cmd2"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushLiteral(new StringValue("var3")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("cmd3"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new SelectIndex(),
          new PushLiteral(new StringValue("var4")),
          new ResolveValue(),
        ]),
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
    const program = compileFirstSentence(script);
    expect(program).to.eql([
      new PushLiteral(new StringValue("this is a \"'\\ $ \nhere-string")),
    ]);

    expect(context.execute(program)).to.eql(
      new StringValue("this is a \"'\\ $ \nhere-string")
    );
  });

  specify("tagged strings", () => {
    const script = parse(
      '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
    );
    const program = compileFirstSentence(script);
    expect(program).to.eql([
      new PushLiteral(
        new StringValue("this is \n a \n \"'\\ $ tagged string\n")
      ),
    ]);

    expect(context.execute(program)).to.eql(
      new StringValue("this is \n a \n \"'\\ $ tagged string\n")
    );
  });

  specify("line comments", () => {
    const script = parse("# this ; is$ (\\\na [comment{");
    const program = compileFirstSentence(script);
    expect(program).to.eql([]);
  });

  specify("block comments", () => {
    const script = parse("##{ this \n ; is$ (a  \n#{comment{[( }##");
    const program = compileFirstSentence(script);
    expect(program).to.eql([]);
  });

  describe("substitutions", () => {
    describe("scalars", () => {
      specify("simple substitution", () => {
        const script = parse("$varname");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
        ]);

        variableResolver.register("varname", new StringValue("value"));
        expect(context.execute(program)).to.eql(new StringValue("value"));
      });
      specify("double substitution", () => {
        const script = parse("$$var1");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("var1")),
          new ResolveValue(),
          new ResolveValue(),
        ]);

        variableResolver.register("var1", new StringValue("var2"));
        variableResolver.register("var2", new StringValue("value"));
        expect(context.execute(program)).to.eql(new StringValue("value"));
      });
      specify("triple substitution", () => {
        const script = parse("$$$var1");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("var1")),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("varname"))]),
          new ResolveValue(),
        ]);

        variableResolver.register("varname", new StringValue("value"));
        expect(context.execute(program)).to.eql(
          new TupleValue([new StringValue("value")])
        );
      });
      specify("multiple variables", () => {
        const script = parse("$(var1 var2)");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("var1")),
            new PushLiteral(new StringValue("var2")),
          ]),
          new ResolveValue(),
        ]);

        variableResolver.register("var1", new StringValue("value1"));
        variableResolver.register("var2", new StringValue("value2"));
        expect(context.execute(program)).to.eql(
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
        );
      });
      specify("double substitution", () => {
        const script = parse("$$(var1)");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("var1"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("var1")),
            new PushTuple([new PushLiteral(new StringValue("var2"))]),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushTuple([new PushLiteral(new StringValue("var1"))]),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("variable name")),
          new ResolveValue(),
        ]);

        variableResolver.register("variable name", new StringValue("value"));
        expect(context.execute(program)).to.eql(new StringValue("value"));
      });
      specify("varname with special characters", () => {
        const script = parse('${variable " " name}');
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue('variable " " name')),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("variable name")),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
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
          new ListValue([new StringValue("value1"), new StringValue("value2")])
        );
      });
      specify("double substitution, scalar", () => {
        const script = parse("$$[cmd]");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new ResolveValue(),
        ]);

        commandResolver.register("cmd", {
          evaluate: () =>
            new TupleValue([new StringValue("var1"), new StringValue("var2")]),
        });
        variableResolver.register("var1", new StringValue("value1"));
        variableResolver.register("var2", new StringValue("value2"));
        expect(context.execute(program)).to.eql(
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
        );
      });
      specify("two sentences", () => {
        const script = parse("[cmd1 result1; cmd2 result2]");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("cmd1")),
            new PushLiteral(new StringValue("result1")),
          ]),
          new EvaluateSentence(),
          new PushTuple([
            new PushLiteral(new StringValue("cmd2")),
            new PushLiteral(new StringValue("result2")),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("cmdname")),
            new ResolveValue(),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("1"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new SelectIndex(),
        ]);

        variableResolver.register(
          "varname",
          new ListValue([new StringValue("value1"), new StringValue("value2")])
        );
        expect(context.execute(program)).to.eql(new StringValue("value2"));
      });
      specify("double substitution", () => {
        const script = parse("$$var1[0]");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("var1")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("0"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("1"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new SelectIndex(),
          new PushTuple([new PushLiteral(new StringValue("0"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("var1")),
          new ResolveValue(),
          new PushTuple([
            new PushLiteral(new StringValue("var2")),
            new ResolveValue(),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushTuple([new PushLiteral(new StringValue("0"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushTuple([new PushLiteral(new StringValue("0"))]),
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
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
        );
      });
    });

    describe("keyed selectors", () => {
      specify("simple substitution", () => {
        const script = parse("$varname(key)");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("var1")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([
            new PushLiteral(new StringValue("key1")),
            new PushLiteral(new StringValue("key2")),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("key1"))]),
          new SelectKeys(),
          new PushTuple([new PushLiteral(new StringValue("key2"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("var1")),
          new ResolveValue(),
          new PushTuple([
            new PushLiteral(new StringValue("var2")),
            new ResolveValue(),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([
            new PushTuple([new PushLiteral(new StringValue("arbitrary key"))]),
            new JoinStrings(),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushLiteral(new StringValue("varname")),
          new ResolveValue(),
          new PushTuple([
            new PushLiteral(
              new ScriptValue(parse("arbitrary key"), "arbitrary key")
            ),
          ]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("var1")),
            new PushLiteral(new StringValue("var2")),
          ]),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
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
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
        );
      });
      specify("recursive tuple", () => {
        const script = parse("$(var1 (var2))(key)");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("var1")),
            new PushTuple([new PushLiteral(new StringValue("var2"))]),
          ]),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
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
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([
            new PushLiteral(new StringValue("var1")),
            new PushLiteral(new StringValue("var2")),
          ]),
          new ResolveValue(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
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
          new TupleValue([new StringValue("value3"), new StringValue("value4")])
        );
      });
      specify("scalar expression", () => {
        const script = parse("$[cmd](key)");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
          new SelectKeys(),
        ]);

        commandResolver.register("cmd", {
          evaluate: () => new MapValue({ key: new StringValue("value") }),
        });
        expect(context.execute(program)).to.eql(new StringValue("value"));
      });
      specify("tuple expression", () => {
        const script = parse("$[cmd](key)");
        const program = compileFirstSentence(script);
        expect(program).to.eql([
          new PushTuple([new PushLiteral(new StringValue("cmd"))]),
          new EvaluateSentence(),
          new SubstituteResult(),
          new PushTuple([new PushLiteral(new StringValue("key"))]),
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
          new TupleValue([new StringValue("value1"), new StringValue("value2")])
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
        new PushTuple([
          new PushLiteral(new StringValue("if")),
          new PushLiteral(new StringValue("true")),
          new PushLiteral(new ScriptValue(parse("cmd1 a"), "cmd1 a")),
          new PushLiteral(new StringValue("else")),
          new PushLiteral(new ScriptValue(parse("cmd2 b"), "cmd2 b")),
        ]),
        new EvaluateSentence(),
      ]);

      const script2 = parse("if false {cmd1 a} else {cmd2 b}");
      const program2 = compiler.compileScript(script2);
      expect(program2).to.eql([
        new PushTuple([
          new PushLiteral(new StringValue("if")),
          new PushLiteral(new StringValue("false")),
          new PushLiteral(new ScriptValue(parse("cmd1 a"), "cmd1 a")),
          new PushLiteral(new StringValue("else")),
          new PushLiteral(new ScriptValue(parse("cmd2 b"), "cmd2 b")),
        ]),
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
        new PushTuple([
          new PushLiteral(new StringValue("repeat")),
          new PushLiteral(new StringValue("10")),
          new PushLiteral(new ScriptValue(parse("cmd foo"), "cmd foo")),
        ]),
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
