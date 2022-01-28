import { expect } from "chai";
import { Evaluator, VariableResolver, CommandResolver } from "./evaluator";
import { Parser } from "./parser";
import { Tokenizer } from "./tokenizer";
import {
  Value,
  StringValue,
  TupleValue,
  ScriptValue,
  ValueType,
  NIL,
  IntegerValue,
  ReferenceValue,
} from "./values";
import { Command } from "./command";
import { IndexedSelector, KeyedSelector, Selector } from "./selectors";

const mapValue = (value: Value) => {
  if (value == NIL) {
    return null;
  }
  if (value instanceof StringValue) {
    return value.value;
  }
  if (value instanceof IntegerValue) {
    return value.value;
  }
  if (value instanceof TupleValue) {
    return value.values.map(mapValue);
  }
  if (value instanceof ScriptValue) {
    return value.script;
  }
  if (value instanceof ReferenceValue) {
    return {
      source: mapValue(value.source),
      selectors: value.selectors.map(mapSelector),
    };
  }
  throw new Error("TODO");
};
const mapSelector = (selector: Selector) => {
  if (selector instanceof IndexedSelector) {
    return { index: mapValue(selector.index) };
  }
  if (selector instanceof KeyedSelector) {
    return { keys: selector.keys.map(mapValue) };
  }
  throw new Error("TODO");
};

class MockVariableResolver implements VariableResolver {
  resolve(name: string): Value {
    return this.variables.get(name);
  }

  variables: Map<string, Value> = new Map();
  register(name: string, value: Value) {
    this.variables.set(name, value);
  }
}

class ListValue implements Value {
  type = ValueType.CUSTOM;
  list: Value[];
  constructor(value: Value[]) {
    this.list = [...value];
  }
  asString(): string {
    throw new Error("TODO");
  }
  selectIndex(index: Value): Value {
    return this.list[parseInt(index.asString())];
  }
  selectKey(key: Value): Value {
    throw new Error("TODO");
  }
}
class MapValue implements Value {
  type = ValueType.CUSTOM;
  map: Map<string, Value>;
  constructor(value: { [key: string]: Value }) {
    this.map = new Map(Object.entries(value));
  }
  asString(): string {
    throw new Error("TODO");
  }
  selectIndex(index: Value): Value {
    throw new Error("TODO");
  }
  selectKey(key: Value): Value {
    return this.map.get(key.asString());
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

  describe("morphemes", () => {
    describe("literals", () => {
      it("evaluate to themselves", () => {
        const script = parse("word");
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("word");
      });
    });

    describe("tuples", () => {
      specify("empty tuple", () => {
        const script = parse("()");
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql([]);
      });
      specify("tuple with one literal", () => {
        const script = parse("( literal )");
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql(["literal"]);
      });
      specify("tuple with two literals", () => {
        const script = parse("( lit1 lit2 )");
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql(["lit1", "lit2"]);
      });
      specify("2-level tuple", () => {
        const script = parse("( (lit1 lit2) lit3 (lit4) )");
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql([["lit1", "lit2"], "lit3", ["lit4"]]);
      });
    });

    describe("blocks", () => {
      it("evaluate to their body parse tree", () => {
        const body = 'a b (c) "d"';
        const script = parse(`{${body}}`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql(parse(body));
      });
    });

    describe("expressions", () => {
      specify("empty expression", () => {
        const script = parse(`[]`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql(null);
      });
      specify("simple command", () => {
        commandResolver.register(
          "cmd",
          new FunctionCommand(() => new StringValue("result"))
        );
        const script = parse(`[cmd]`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("result");
      });
      specify("single argument", () => {
        commandResolver.register("cmd", new FunctionCommand((args) => args[1]));
        const script = parse(`[cmd arg]`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("arg");
      });
      specify("multiple arguments", () => {
        commandResolver.register(
          "cmd",
          new FunctionCommand(
            (args) =>
              new StringValue(args.map((value) => value.asString()).join(""))
          )
        );
        const script = parse(`[cmd foo bar baz]`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("cmdfoobarbaz");
      });
      specify("multiple sentences", () => {
        variableResolver.register("var", new StringValue("f"));
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) => new TupleValue(args))
        );
        const script = parse(`[cmd a b; ;
          
          ; cmd c d]`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql(["cmd", "c", "d"]);
      });
      specify("complex case", () => {
        variableResolver.register("var", new StringValue("f"));
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) => new TupleValue(args))
        );
        const script = parse(`[cmd a [cmd b (c d)] "e" $var]`);
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
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
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("");
      });
      specify("simple string", () => {
        const script = parse('"this is a string"');
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("this is a string");
      });

      describe("expressions", () => {
        specify("simple command", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("is"))
          );
          const script = parse('"this [cmd] a string"');
          const morpheme = script.sentences[0].words[0].morphemes[0];
          const value = evaluator.evaluateMorpheme(morpheme);
          expect(mapValue(value)).to.eql("this is a string");
        });
        specify("multiple commands", () => {
          commandResolver.register(
            "cmd1",
            new FunctionCommand(() => new StringValue("i"))
          );
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => new StringValue("s"))
          );
          const script = parse('"this [cmd1][cmd2] a string"');
          const morpheme = script.sentences[0].words[0].morphemes[0];
          const value = evaluator.evaluateMorpheme(morpheme);
          expect(mapValue(value)).to.eql("this is a string");
        });
      });

      describe("variable substitutions", () => {
        describe("scalars", () => {
          specify("simple substitution", () => {
            variableResolver.register("var", new StringValue("value"));
            const script = parse('"$var"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", new StringValue("var2"));
            variableResolver.register("var2", new StringValue("value"));
            const script = parse('"$$var1"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("triple substitution", () => {
            variableResolver.register("var1", new StringValue("var2"));
            variableResolver.register("var2", new StringValue("var3"));
            variableResolver.register("var3", new StringValue("value"));
            const script = parse('"$$$var1"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("blocks", () => {
          specify("varname with spaces", () => {
            variableResolver.register(
              "variable name",
              new StringValue("value")
            );
            const script = parse('"${variable name}"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("varname with special characters", () => {
            variableResolver.register(
              'variable " " name',
              new StringValue("value")
            );
            const script = parse('"${variable " " name}"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("varname with continuations", () => {
            variableResolver.register(
              "variable name",
              new StringValue("value")
            );
            const script = parse('"${variable\\\n \t\r     name}"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("expressions", () => {
          specify("simple substitution", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => new StringValue("value"))
            );
            const script = parse('"$[cmd]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => new StringValue("var"))
            );
            variableResolver.register("var", new StringValue("value"));
            const script = parse('"$$[cmd]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("indexed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              new ListValue([
                new StringValue("value1"),
                new StringValue("value2"),
              ])
            );
            const script = parse('"$var[1]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value2");
          });
          specify("double substitution", () => {
            variableResolver.register(
              "var1",
              new ListValue([new StringValue("var2")])
            );
            variableResolver.register("var2", new StringValue("value"));
            const script = parse('"$$var1[0]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive indexes", () => {
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
            const script = parse('"$var[1][0]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value2_1");
          });
          specify("indirect index", () => {
            variableResolver.register(
              "var1",
              new ListValue([
                new StringValue("value1"),
                new StringValue("value2"),
                new StringValue("value3"),
              ])
            );
            variableResolver.register("var2", new StringValue("1"));
            const script = parse('"$var1[$var2]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value2");
          });
          specify("expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(
                () => new ListValue([new StringValue("value")])
              )
            );
            const script = parse('"$[cmd][0]"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("keyed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
            );
            const script = parse('"$var(key)"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register(
              "var1",
              new MapValue({ key: new StringValue("var2") })
            );
            variableResolver.register("var2", new StringValue("value"));
            const script = parse('"$$var1(key)"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("recursive keys", () => {
            variableResolver.register(
              "var",
              new MapValue({
                key1: new MapValue({ key2: new StringValue("value") }),
              })
            );
            const script = parse('"$var(key1 key2)"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive keys", () => {
            variableResolver.register(
              "var",
              new MapValue({
                key1: new MapValue({ key2: new StringValue("value") }),
              })
            );
            const script = parse('"$var(key1)(key2)"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("indirect key", () => {
            variableResolver.register(
              "var1",
              new MapValue({
                key: new StringValue("value"),
              })
            );
            variableResolver.register("var2", new StringValue("key"));
            const script = parse('"$var1($var2)"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("string key", () => {
            variableResolver.register(
              "var",
              new MapValue({
                "arbitrary key": new StringValue("value"),
              })
            );
            const script = parse('"$var("arbitrary key")"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
          specify("expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(
                () => new MapValue({ key: new StringValue("value") })
              )
            );
            const script = parse('"$[cmd](key)"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("compound", () => {
          specify("beginning", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
            );
            const script = parse('"$var(key)foo"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("valuefoo");
          });
          specify("middle", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
            );
            const script = parse('"foo$var(key)bar"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("foovaluebar");
          });
          specify("end", () => {
            variableResolver.register("var", new StringValue("value"));
            const script = parse('"foo$var"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("foovalue");
          });
          specify("multiple", () => {
            variableResolver.register(
              "var1",
              new MapValue({ key1: new StringValue("value1") })
            );
            variableResolver.register(
              "var2",
              new MapValue({ key2: new StringValue("value2") })
            );
            const script = parse('"foo$var1(key1)bar$var2(key2)baz"');
            const morpheme = script.sentences[0].words[0].morphemes[0];
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("foovalue1barvalue2baz");
          });
        });
      });

      specify("string with multiple substitutions", () => {
        variableResolver.register("var1", new StringValue("is"));
        variableResolver.register("variable 2", new StringValue("a"));
        commandResolver.register(
          "cmd",
          new FunctionCommand(() => new StringValue("string"))
        );
        const script = parse(
          '"this $var1 ${variable 2} [cmd] with substitutions"'
        );
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("this is a string with substitutions");
      });
    });

    describe("here strings", () => {
      it("evaluate to their content", () => {
        const script = parse('"""this is a "\'\\ $ \nhere string"""');
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
        expect(mapValue(value)).to.eql("this is a \"'\\ $ \nhere string");
      });
    });

    describe("tagged strings", () => {
      it("evaluate to their content", () => {
        const script = parse(
          '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
        );
        const morpheme = script.sentences[0].words[0].morphemes[0];
        const value = evaluator.evaluateMorpheme(morpheme);
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

    describe("references", () => {
      describe("scalars", () => {
        specify("indexed selector", () => {
          const script = parse("var[123]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql({
            source: "var",
            selectors: [{ index: "123" }],
          });
        });
        specify("keyed selector", () => {
          const script = parse("var(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql({
            source: "var",
            selectors: [{ keys: ["key"] }],
          });
        });
        specify("multiple selectors", () => {
          const script = parse("var(key1 key2 key3)[1][2](key4)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql({
            source: "var",
            selectors: [
              { keys: ["key1", "key2", "key3"] },
              { index: "1" },
              { index: "2" },
              { keys: ["key4"] },
            ],
          });
        });
        describe("exceptions", () => {
          specify("invalid trailing morphemes", () => {
            const script = parse("var(key1)2");
            const word = script.sentences[0].words[0];
            expect(() => evaluator.evaluateWord(word)).to.throws(
              "extra characters after selectors"
            );
          });
        });
      });
      describe("tuples", () => {
        specify("indexed selector", () => {
          const script = parse("(var1 var2 (var3 var4))[123]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql({
            source: ["var1", "var2", ["var3", "var4"]],
            selectors: [{ index: "123" }],
          });
        });
        specify("keyed selector", () => {
          const script = parse("(var1 (var2) var3)(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql({
            source: ["var1", ["var2"], "var3"],
            selectors: [{ keys: ["key"] }],
          });
        });
        specify("multiple selectors", () => {
          const script = parse("((var))(key1 key2 key3)[1][2](key4)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql({
            source: [["var"]],
            selectors: [
              { keys: ["key1", "key2", "key3"] },
              { index: "1" },
              { index: "2" },
              { keys: ["key4"] },
            ],
          });
        });
        describe("exceptions", () => {
          specify("invalid trailing morphemes", () => {
            const script = parse("(var1 var2)(key1)2");
            const word = script.sentences[0].words[0];
            expect(() => evaluator.evaluateWord(word)).to.throws(
              "extra characters after selectors"
            );
          });
        });
      });
    });

    describe("substitutions", () => {
      describe("scalars", () => {
        specify("simple substitution", () => {
          variableResolver.register("var", new StringValue("value"));
          const script = parse("$var");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution", () => {
          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          const script = parse("$$var1");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("triple substitution", () => {
          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("var3"));
          variableResolver.register("var3", new StringValue("value"));
          const script = parse("$$$var1");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
      });

      describe("tuples", () => {
        specify("single variable", () => {
          variableResolver.register("var", new StringValue("value"));
          const script = parse("$(var)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value"]);
        });
        specify("multiple variables", () => {
          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          const script = parse("$(var1 var2)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
        specify("double substitution", () => {
          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          const script = parse("$$(var1)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value"]);
        });
        specify("nested tuples", () => {
          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
          const script = parse("$(var1 (var2))");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", ["value2"]]);
        });
        specify("nested double substitution", () => {
          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          const script = parse("$$((var1))");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql([["value"]]);
        });
      });

      describe("blocks", () => {
        specify("varname with spaces", () => {
          variableResolver.register("variable name", new StringValue("value"));
          const script = parse("${variable name}");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("varname with special characters", () => {
          variableResolver.register(
            'variable " " name',
            new StringValue("value")
          );
          const script = parse('${variable " " name}');
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("varname with continuations", () => {
          variableResolver.register("variable name", new StringValue("value"));
          const script = parse("${variable\\\n \t\r     name}");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
      });

      describe("expressions", () => {
        specify("simple substitution", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("value"))
          );
          const script = parse("$[cmd]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution, scalar", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new StringValue("var"))
          );
          variableResolver.register("var", new StringValue("value"));
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
                  new StringValue("var1"),
                  new StringValue("var2"),
                ])
            )
          );
          variableResolver.register("var1", new StringValue("value1"));
          variableResolver.register("var2", new StringValue("value2"));
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
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
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
            new ListValue([new StringValue("var2")])
          );
          variableResolver.register("var2", new StringValue("value"));
          const script = parse("$$var1[0]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("successive indexes", () => {
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
          const script = parse("$var[1][0]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value2_1");
        });
        specify("indirect index", () => {
          variableResolver.register(
            "var1",
            new ListValue([
              new StringValue("value1"),
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          );
          variableResolver.register("var2", new StringValue("1"));
          const script = parse("$var1[$var2]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value2");
        });
        specify("scalar expression", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => new ListValue([new StringValue("value")]))
          );
          const script = parse("$[cmd][0]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("tuple expression", () => {
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
          const script = parse("$[cmd][0]");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
      });

      describe("keyed selectors", () => {
        specify("simple substitution", () => {
          variableResolver.register(
            "var",
            new MapValue({ key: new StringValue("value") })
          );
          const script = parse("$var(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("double substitution", () => {
          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("var2") })
          );
          variableResolver.register("var2", new StringValue("value"));
          const script = parse("$$var1(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("recursive keys", () => {
          variableResolver.register(
            "var",
            new MapValue({
              key1: new MapValue({ key2: new StringValue("value") }),
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
            new MapValue({
              key1: new MapValue({ key2: new StringValue("value") }),
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
            new MapValue({
              key: new StringValue("value"),
            })
          );
          variableResolver.register("var2", new StringValue("key"));
          const script = parse("$var1($var2)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("string key", () => {
          variableResolver.register(
            "var",
            new MapValue({
              "arbitrary key": new StringValue("value"),
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
            new MapValue({ key: new StringValue("value1") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("value2") })
          );
          const script = parse("$(var1 var2)(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
        specify("recursive tuple", () => {
          variableResolver.register(
            "var1",
            new MapValue({ key: new StringValue("value1") })
          );
          variableResolver.register(
            "var2",
            new MapValue({ key: new StringValue("value2") })
          );
          const script = parse("$(var1 (var2))(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", ["value2"]]);
        });
        specify("tuple with double substitution", () => {
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
          const script = parse("$$(var1 var2)(key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value3", "value4"]);
        });
        specify("scalar expression", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(
              () => new MapValue({ key: new StringValue("value") })
            )
          );
          const script = parse("$[cmd](key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("value");
        });
        specify("tuple expression", () => {
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
          const script = parse("$[cmd](key)");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["value1", "value2"]);
        });
        describe("exceptions", () => {
          specify("empty selector", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
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
        specify("invalid trailing morphemes", () => {
          variableResolver.register(
            "var",
            new MapValue({ key: new StringValue("value") })
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
