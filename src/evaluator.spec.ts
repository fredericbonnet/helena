import { expect } from "chai";
import { Evaluator, VariableResolver, VariableValue } from "./evaluator";
import { Parser } from "./parser";
import { Tokenizer } from "./tokenizer";

class MockVariableResolver implements VariableResolver {
  resolve(name: string): VariableValue {
    return this.variables.get(name);
  }

  variables: Map<string, VariableValue> = new Map();
  register(name: string, value: VariableValue) {
    this.variables.set(name, value);
  }
}

class StringValue implements VariableValue {
  value: string;
  constructor(value: string) {
    this.value = value;
  }
  asString(): string {
    return this.value;
  }
  selectKey(key: string): VariableValue {
    throw new Error("TODO");
  }
}
class MapValue implements VariableValue {
  value: Map<string, VariableValue>;
  constructor(value: { [key: string]: VariableValue }) {
    this.value = new Map(Object.entries(value));
  }
  asString(): string {
    throw new Error("TODO");
  }
  selectKey(key: string): VariableValue {
    return this.value.get(key);
  }
}

describe("Evaluator", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let variableResolver: MockVariableResolver;
  let evaluator: Evaluator;

  const parse = (script: string) => parser.parse(tokenizer.tokenize(script));

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    variableResolver = new MockVariableResolver();
    evaluator = new Evaluator(variableResolver);
  });

  describe("syllables", () => {
    describe("literals", () => {
      it("evaluate to themselves", () => {
        const script = parse("word");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql("word");
      });
    });

    describe("tuples", () => {
      specify("empty tuple", () => {
        const script = parse("()");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql([]);
      });
      specify("tuple with one literal", () => {
        const script = parse("( literal )");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql(["literal"]);
      });
      specify("tuple with two literals", () => {
        const script = parse("( lit1 lit2 )");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql(["lit1", "lit2"]);
      });
      specify("2-level tuple", () => {
        const script = parse("( (lit1 lit2) lit3 (lit4) )");
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql([["lit1", "lit2"], "lit3", ["lit4"]]);
      });
    });

    describe("blocks", () => {
      it("evaluate to their body parse tree", () => {
        const body = 'a b (c) "d"';
        const script = parse(`{${body}}`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql(parse(body));
      });
    });

    describe("expressions", () => {
      it.skip("TODO", () => {
        const body = 'a b (c) "d"';
        const script = parse(`[${body}]`);
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql("TODO");
      });
    });

    describe("strings", () => {
      specify("empty string", () => {
        const script = parse('""');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql("");
      });
      specify("simple string", () => {
        const script = parse('"this is a string"');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql("this is a string");
      });

      describe("variable substitutions", () => {
        describe("scalars", () => {
          specify("simple substitution", () => {
            variableResolver.register("var", new StringValue("value"));
            const script = parse('"$var"');
            const syllable = script.sentences[0].words[0].syllables[0];
            const value = evaluator.evaluateSyllable(syllable);
            expect(value).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", new StringValue("var2"));
            variableResolver.register("var2", new StringValue("value"));
            const script = parse('"$$var1"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
          specify("triple substitution", () => {
            variableResolver.register("var1", new StringValue("var2"));
            variableResolver.register("var2", new StringValue("var3"));
            variableResolver.register("var3", new StringValue("value"));
            const script = parse('"$$$var1"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
        });

        describe("keyed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
            );
            const script = parse('"$var(key)"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register(
              "var1",
              new MapValue({ key: new StringValue("var2") })
            );
            variableResolver.register("var2", new StringValue("value"));
            const script = parse('"$$var1(key)"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
          specify("recursive keys", () => {
            variableResolver.register(
              "var",
              new MapValue({
                key1: new MapValue({ key2: new StringValue("value") }),
              })
            );
            const script = parse('"$var(key1 key2)"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
          specify("successive keys", () => {
            variableResolver.register(
              "var",
              new MapValue({
                key1: new MapValue({ key2: new StringValue("value") }),
              })
            );
            const script = parse('"$var(key1)(key2)"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
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
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
          specify("string key", () => {
            variableResolver.register(
              "var",
              new MapValue({
                "arbitrary key": new StringValue("value"),
              })
            );
            const script = parse('"$var("arbitrary key")"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("value");
          });
        });

        describe("compound", () => {
          specify("beginning", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
            );
            const script = parse('"$var(key)foo"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("valuefoo");
          });
          specify("middle", () => {
            variableResolver.register(
              "var",
              new MapValue({ key: new StringValue("value") })
            );
            const script = parse('"foo$var(key)bar"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("foovaluebar");
          });
          specify("end", () => {
            variableResolver.register("var", new StringValue("value"));
            const script = parse('"foo$var"');
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("foovalue");
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
            const word = script.sentences[0].words[0];
            const value = evaluator.evaluateWord(word);
            expect(value).to.eql("foovalue1barvalue2baz");
          });
        });
      });

      specify.skip("string with multiple substitutions", () => {
        const script = parse('"this $var1 ${var2} [cmd] with substitutions "');
        const syllable = script.sentences[0].words[0].syllables[0];
        const value = evaluator.evaluateSyllable(syllable);
        expect(value).to.eql("this is a string with substitutions");
      });
    });
  });

  describe("words", () => {
    describe("single literals", () => {
      it("evaluate to themselves", () => {
        const script = parse("word");
        const word = script.sentences[0].words[0];
        const value = evaluator.evaluateWord(word);
        expect(value).to.eql("word");
      });
    });

    describe("variable names", () => {
      it.skip("TODO", () => {
        const script = parse("var(key)");
        const word = script.sentences[0].words[0];
        const value = evaluator.evaluateWord(word);
        expect(value).to.eql("var(key)");
      });
    });
    
    describe("variable substitutions", () => {
      describe("scalars", () => {
        specify("simple substitution", () => {
          variableResolver.register("var", new StringValue("value"));
          const script = parse("$var");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(value).to.eql("value");
        });
        specify("double substitution", () => {
          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("value"));
          const script = parse("$$var1");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(value).to.eql("value");
        });
        specify("triple substitution", () => {
          variableResolver.register("var1", new StringValue("var2"));
          variableResolver.register("var2", new StringValue("var3"));
          variableResolver.register("var3", new StringValue("value"));
          const script = parse("$$$var1");
          const word = script.sentences[0].words[0];
          const value = evaluator.evaluateWord(word);
          expect(value).to.eql("value");
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
          expect(value).to.eql("value");
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
          expect(value).to.eql("value");
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
          expect(value).to.eql("value");
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
          expect(value).to.eql("value");
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
          expect(value).to.eql("value");
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
          expect(value).to.eql("value");
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
        specify("invalid trailing syllables", () => {
          variableResolver.register(
            "var",
            new MapValue({ key: new StringValue("value") })
          );
          const script = parse("$var(key)foo");
          const word = script.sentences[0].words[0];
          expect(() => evaluator.evaluateWord(word)).to.throws(
            "extra characters after variable selectors"
          );
        });
      });
    });
  });
});
