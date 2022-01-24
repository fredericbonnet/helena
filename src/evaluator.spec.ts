import { expect } from "chai";
import { Evaluator, VariableResolver, CommandResolver } from "./evaluator";
import { Parser } from "./parser";
import { Reference } from "./reference";
import { Tokenizer } from "./tokenizer";
import {
  Value,
  NilValue,
  LiteralValue,
  TupleValue,
  ScriptValue,
} from "./values";
import { Command } from "./command";

const mapValue = (value: Value) => {
  if (value instanceof NilValue) {
    return null;
  }
  if (value instanceof LiteralValue) {
    return value.value;
  }
  if (value instanceof TupleValue) {
    return value.values.map(mapValue);
  }
  if (value instanceof ScriptValue) {
    return value.script;
  }
};

class MockVariableResolver implements VariableResolver {
  resolve(name: string): Reference {
    return this.variables.get(name);
  }

  variables: Map<string, Reference> = new Map();
  register(name: string, value: Reference) {
    this.variables.set(name, value);
  }
}

class StringReference implements Reference {
  literal: Value;
  constructor(value: string) {
    this.literal = new LiteralValue(value);
  }
  getValue(): Value {
    return this.literal;
  }
  selectIndex(index: Value): Reference {
    throw new Error("TODO");
  }
  selectKey(key: Value): Reference {
    throw new Error("TODO");
  }
}
class ListReference implements Reference {
  list: Reference[];
  constructor(value: Reference[]) {
    this.list = [...value];
  }
  getValue(): Value {
    throw new Error("TODO");
  }
  selectIndex(index: Value): Reference {
    return this.list[parseInt((index as LiteralValue).value)];
  }
  selectKey(key: Value): Reference {
    throw new Error("TODO");
  }
}
class MapReference implements Reference {
  map: Map<string, Reference>;
  constructor(value: { [key: string]: Reference }) {
    this.map = new Map(Object.entries(value));
  }
  getValue(): Value {
    throw new Error("TODO");
  }
  selectIndex(index: Value): Reference {
    throw new Error("TODO");
  }
  selectKey(key: Value): Reference {
    return this.map.get((key as LiteralValue).value);
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
class FunctionCommand implements Command {
  fn: (args: Value[]) => Value;
  constructor(fn: (args: Value[]) => Value) {
    this.fn = fn;
  }

  evaluate(args: Value[]): Value {
    return this.fn(args);
  }
}

describe("Evaluator", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let variableResolver: MockVariableResolver;
  let commandResolver: MockCommandResolver;
  let evaluator: Evaluator;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    variableResolver = new MockVariableResolver();
    commandResolver = new MockCommandResolver();
    evaluator = new Evaluator(variableResolver, commandResolver);
  });

  describe("syllables", () => {
    describe("literals", () => {
      it("evaluate to themselves", () => {
        const script = parse("word");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("word");
      });
    });

    describe("tuples", () => {
      specify("empty tuple", () => {
        const script = parse("()");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql([]);
      });
      specify("tuple with one literal", () => {
        const script = parse("( literal )");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql(["literal"]);
      });
      specify("tuple with two literals", () => {
        const script = parse("( lit1 lit2 )");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql(["lit1", "lit2"]);
      });
      specify("2-level tuple", () => {
        const script = parse("( (lit1 lit2) lit3 (lit4) )");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql([["lit1", "lit2"], "lit3", ["lit4"]]);
      });
    });

    describe("blocks", () => {
      it("evaluate to their body parse tree", () => {
        const body = 'a b (c) "d"';
        const script = parse(`{${body}}`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql(parse(body));
      });
    });

    describe("expressions", () => {
      specify("empty expression", () => {
        const script = parse(`[]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql(null);
      });
      specify("simple command", () => {
        commandResolver.register(
          "cmd",
          new FunctionCommand(() => new LiteralValue("result"))
        );
        const script = parse(`[cmd]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("result");
      });
      specify("single argument", () => {
        commandResolver.register("cmd", new FunctionCommand((args) => args[1]));
        const script = parse(`[cmd arg]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("arg");
      });
      specify("multiple arguments", () => {
        commandResolver.register(
          "cmd",
          new FunctionCommand(
            (args) =>
              new LiteralValue(
                args.map((value) => (value as LiteralValue).value).join("")
              )
          )
        );
        const script = parse(`[cmd foo bar baz]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("cmdfoobarbaz");
      });
      specify("multiple sentences", () => {
        variableResolver.register("var", new StringReference("f"));
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) => new TupleValue(args))
        );
        const script = parse(`[cmd a b; ;
          
          ; cmd c d]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql(["cmd", "c", "d"]);
      });
      specify("complex case", () => {
        variableResolver.register("var", new StringReference("f"));
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) => new TupleValue(args))
        );
        const script = parse(`[cmd a [cmd b (c d)] "e" $var]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql([
          "cmd",
          "a",
          ["cmd", "b", ["c", "d"]],
          "e",
          "f",
        ]);
      });
    });

    describe("strings", () => {
      specify("empty string", () => {
        const script = parse('""');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("");
      });
      specify("simple string", () => {
        const script = parse('"this is a string"');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("this is a string");
      });

      describe("expressions", () => {
        specify("simple command", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new LiteralValue("is"))
          );
          const script = parse('"this [cmd] a string"');
          const syllable = script.sentences[0].words[0].syllables[0];
          const value = evaluator.evaluateSyllable(syllable);
          expect(mapValue(value)).to.eql("this is a string");
        });
        specify("multiple commands", () => {
          commandResolver.register(
            "cmd1",
            new FunctionCommand(() => new LiteralValue("i"))
          );
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => new LiteralValue("s"))
          );
          const script = parse('"this [cmd1][cmd2] a string"');
          const syllable = script.sentences[0].words[0].syllables[0];
          const value = evaluator.evaluateSyllable(syllable);
          expect(mapValue(value)).to.eql("this is a string");
        });
      });

      describe("variable substitutions", () => {
        describe("scalars", () => {
          specify("simple substitution", () => {
            variableResolver.register("var", new StringReference("value"));
            const script = parse('"$var"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", new StringReference("var2"));
            variableResolver.register("var2", new StringReference("value"));
            const script = parse('"$$var1"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("triple substitution", () => {
            variableResolver.register("var1", new StringReference("var2"));
            variableResolver.register("var2", new StringReference("var3"));
            variableResolver.register("var3", new StringReference("value"));
            const script = parse('"$$$var1"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("expressions", () => {
          specify("simple substitution", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => new LiteralValue("value"))
            );
            const script = parse('"$[cmd]"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => new LiteralValue("var"))
            );
            variableResolver.register("var", new StringReference("value"));
            const script = parse('"$$[cmd]"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("indexed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              new ListReference([
                new StringReference("value1"),
                new StringReference("value2"),
              ])
            );
            const script = parse('"$var[1]"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value2");
          });
          specify("double substitution", () => {
            variableResolver.register(
              "var1",
              new ListReference([new StringReference("var2")])
            );
            variableResolver.register("var2", new StringReference("value"));
            const script = parse('"$$var1[0]"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive indexes", () => {
            variableResolver.register(
              "var",
              new ListReference([
                new StringReference("value1"),
                new ListReference([
                  new StringReference("value2_1"),
                  new StringReference("value2_2"),
                ]),
              ])
            );
            const script = parse('"$var[1][0]"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value2_1");
          });
          specify("indirect index", () => {
            variableResolver.register(
              "var1",
              new ListReference([
                new StringReference("value1"),
                new StringReference("value2"),
                new StringReference("value3"),
              ])
            );
            variableResolver.register("var2", new StringReference("1"));
            const script = parse('"$var1[$var2]"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value2");
          });
        });

        describe("keyed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              new MapReference({ key: new StringReference("value") })
            );
            const script = parse('"$var(key)"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register(
              "var1",
              new MapReference({ key: new StringReference("var2") })
            );
            variableResolver.register("var2", new StringReference("value"));
            const script = parse('"$$var1(key)"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("recursive keys", () => {
            variableResolver.register(
              "var",
              new MapReference({
                key1: new MapReference({ key2: new StringReference("value") }),
              })
            );
            const script = parse('"$var(key1 key2)"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive keys", () => {
            variableResolver.register(
              "var",
              new MapReference({
                key1: new MapReference({ key2: new StringReference("value") }),
              })
            );
            const script = parse('"$var(key1)(key2)"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("indirect key", () => {
            variableResolver.register(
              "var1",
              new MapReference({
                key: new StringReference("value"),
              })
            );
            variableResolver.register("var2", new StringReference("key"));
            const script = parse('"$var1($var2)"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
          specify("string key", () => {
            variableResolver.register(
              "var",
              new MapReference({
                "arbitrary key": new StringReference("value"),
              })
            );
            const script = parse('"$var("arbitrary key")"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("compound", () => {
          specify("beginning", () => {
            variableResolver.register(
              "var",
              new MapReference({ key: new StringReference("value") })
            );
            const script = parse('"$var(key)foo"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("valuefoo");
          });
          specify("middle", () => {
            variableResolver.register(
              "var",
              new MapReference({ key: new StringReference("value") })
            );
            const script = parse('"foo$var(key)bar"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("foovaluebar");
          });
          specify("end", () => {
            variableResolver.register("var", new StringReference("value"));
            const script = parse('"foo$var"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("foovalue");
          });
          specify("multiple", () => {
            variableResolver.register(
              "var1",
              new MapReference({ key1: new StringReference("value1") })
            );
            variableResolver.register(
              "var2",
              new MapReference({ key2: new StringReference("value2") })
            );
            const script = parse('"foo$var1(key1)bar$var2(key2)baz"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(mapValue(value)).to.eql("foovalue1barvalue2baz");
          });
        });
      });

      specify.skip("string with multiple substitutions", () => {
        const script = parse('"this $var1 ${var2} [cmd] with substitutions "');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("this is a string with substitutions");
      });
    });

    describe("here strings", () => {
      it("evaluate to their content", () => {
        const script = parse('"""this is a "\'\\ $ \nhere string"""');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql("this is a \"'\\ $ \nhere string");
      });
    });

    describe("tagged strings", () => {
      it("evaluate to their content", () => {
        const script = parse(
          '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
        );
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(mapValue(value)).to.eql(
          "this is \n a \n \"'\\ $ tagged string\n"
        );
      });
    });
  });

  describe("words", () => {
    describe("single literals", () => {
      it("evaluate to themselves", () => {
        const script = parse("word");
        const word = script.sentences[0].words[0];
        const value = evaluator.evaluateWord(word);
        expect(mapValue(value)).to.eql("word");
      });
    });

    describe("variable names", () => {
      it.skip("TODO", () => {
        const script = parse("var(key)");
        const word = script.sentences[0].words[0];
        const value = evaluator.evaluateWord(word);
        expect(mapValue(value)).to.eql("var(key)");
      });
    });

    describe("substitutions", () => {
      describe("scalars", () => {
        specify("simple substitution", () => {
          variableResolver.register("var", new StringReference("value"));
          const script = parse("$var");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution", () => {
          variableResolver.register("var1", new StringReference("var2"));
          variableResolver.register("var2", new StringReference("value"));
          const script = parse("$$var1");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("triple substitution", () => {
          variableResolver.register("var1", new StringReference("var2"));
          variableResolver.register("var2", new StringReference("var3"));
          variableResolver.register("var3", new StringReference("value"));
          const script = parse("$$$var1");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
      });

      describe("tuples", () => {
        specify("single variable", () => {
          variableResolver.register("var", new StringReference("value"));
          const script = parse("$(var)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value"]);
        });
        specify("multiple variables", () => {
          variableResolver.register("var1", new StringReference("value1"));
          variableResolver.register("var2", new StringReference("value2"));
          const script = parse("$(var1 var2)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
        specify("double substitution", () => {
          variableResolver.register("var1", new StringReference("var2"));
          variableResolver.register("var2", new StringReference("value"));
          const script = parse("$$(var1)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value"]);
        });
        specify("nested tuples", () => {
          variableResolver.register("var1", new StringReference("value1"));
          variableResolver.register("var2", new StringReference("value2"));
          const script = parse("$(var1 (var2))");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", ["value2"]]);
        });
        specify("nested double substitution", () => {
          variableResolver.register("var1", new StringReference("var2"));
          variableResolver.register("var2", new StringReference("value"));
          const script = parse("$$((var1))");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql([["value"]]);
        });
      });

      describe("expressions", () => {
        specify("simple substitution", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new LiteralValue("value"))
          );
          const script = parse("$[cmd]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution, scalar", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new LiteralValue("var"))
          );
          variableResolver.register("var", new StringReference("value"));
          const script = parse("$$[cmd]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution, tuple", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () =>
                new TupleValue([
                  new LiteralValue("var1"),
                  new LiteralValue("var2"),
                ])
            )
          );
          variableResolver.register("var1", new StringReference("value1"));
          variableResolver.register("var2", new StringReference("value2"));
          const script = parse("$$[cmd]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
      });

      describe("indexed selectors", () => {
        specify("simple substitution", () => {
          variableResolver.register(
            "var",
            new ListReference([
              new StringReference("value1"),
              new StringReference("value2"),
            ])
          );
          const script = parse("$var[1]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value2");
        });
        specify("double substitution", () => {
          variableResolver.register(
            "var1",
            new ListReference([new StringReference("var2")])
          );
          variableResolver.register("var2", new StringReference("value"));
          const script = parse("$$var1[0]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("successive indexes", () => {
          variableResolver.register(
            "var",
            new ListReference([
              new StringReference("value1"),
              new ListReference([
                new StringReference("value2_1"),
                new StringReference("value2_2"),
              ]),
            ])
          );
          const script = parse("$var[1][0]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value2_1");
        });
        specify("indirect index", () => {
          variableResolver.register(
            "var1",
            new ListReference([
              new StringReference("value1"),
              new StringReference("value2"),
              new StringReference("value3"),
            ])
          );
          variableResolver.register("var2", new StringReference("1"));
          const script = parse("$var1[$var2]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value2");
        });
      });

      describe("keyed selectors", () => {
        specify("simple substitution", () => {
          variableResolver.register(
            "var",
            new MapReference({ key: new StringReference("value") })
          );
          const script = parse("$var(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution", () => {
          variableResolver.register(
            "var1",
            new MapReference({ key: new StringReference("var2") })
          );
          variableResolver.register("var2", new StringReference("value"));
          const script = parse("$$var1(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("recursive keys", () => {
          variableResolver.register(
            "var",
            new MapReference({
              key1: new MapReference({ key2: new StringReference("value") }),
            })
          );
          const script = parse("$var(key1 key2)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("successive keys", () => {
          variableResolver.register(
            "var",
            new MapReference({
              key1: new MapReference({ key2: new StringReference("value") }),
            })
          );
          const script = parse("$var(key1)(key2)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("indirect key", () => {
          variableResolver.register(
            "var1",
            new MapReference({
              key: new StringReference("value"),
            })
          );
          variableResolver.register("var2", new StringReference("key"));
          const script = parse("$var1($var2)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("string key", () => {
          variableResolver.register(
            "var",
            new MapReference({
              "arbitrary key": new StringReference("value"),
            })
          );
          const script = parse('$var("arbitrary key")');
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("tuple", () => {
          variableResolver.register(
            "var1",
            new MapReference({ key: new StringReference("value1") })
          );
          variableResolver.register(
            "var2",
            new MapReference({ key: new StringReference("value2") })
          );
          const script = parse("$(var1 var2)(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
        specify("recursive tuple", () => {
          variableResolver.register(
            "var1",
            new MapReference({ key: new StringReference("value1") })
          );
          variableResolver.register(
            "var2",
            new MapReference({ key: new StringReference("value2") })
          );
          const script = parse("$(var1 (var2))(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", ["value2"]]);
        });
        specify("tuple with double substitution", () => {
          variableResolver.register(
            "var1",
            new MapReference({ key: new StringReference("var3") })
          );
          variableResolver.register(
            "var2",
            new MapReference({ key: new StringReference("var4") })
          );
          variableResolver.register("var3", new StringReference("value3"));
          variableResolver.register("var4", new StringReference("value4"));
          const script = parse("$$(var1 var2)(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value3", "value4"]);
        });
        specify.skip("expression", () => {
          const script = parse("$[cmd](key)");
        });
        describe("exceptions", () => {
          specify("empty selector", () => {
            variableResolver.register(
              "var",
              new MapReference({ key: new StringReference("value") })
            );
            const script = parse("$var()");
            const word = script.sentences[0].words[0];
            expect(() => evaluator.evaluateWord(word)).to.throws(
              "empty selector"
            );
          });
        });
      });

      describe("exceptions", () => {
        specify("unknown variable", () => {
          const script = parse("$var");
          const word = script.sentences[0].words[0];
          expect(() => evaluator.evaluateWord(word)).to.throws(
            "cannot resolve variable"
          );
        });
        specify("invalid trailing syllables", () => {
          variableResolver.register(
            "var",
            new MapReference({ key: new StringReference("value") })
          );
          const script = parse("$var(key)foo");
          const word = script.sentences[0].words[0];
          expect(() => evaluator.evaluateWord(word)).to.throws(
            "extra characters after selectors"
          );
        });
      });
    });
  });
});
