import { expect } from "chai";
import {
  VariableResolver,
  CommandResolver,
  SelectorResolver,
} from "./resolvers";
import { Evaluator, InlineEvaluator, CompilingEvaluator } from "./evaluator";
import { Parser } from "./parser";
import { Tokenizer } from "./tokenizer";
import { Script, Word } from "./syntax";
import {
  Value,
  StringValue,
  ListValue,
  DictionaryValue,
  TupleValue,
  ScriptValue,
  NIL,
  IntegerValue,
  QualifiedValue,
  ValueType,
  INT,
  LIST,
  DICT,
  STR,
  TUPLE,
} from "./values";
import { Result, ResultCode, OK, RETURN, ERROR } from "./results";
import { Command } from "./command";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";

const asString = (value) => StringValue.toString(value).data;

const mapValue = (value: Value) => {
  if (value == NIL) {
    return NIL;
  }
  if (value instanceof StringValue) {
    return value.value;
  }
  if (value instanceof IntegerValue) {
    return value.value;
  }
  if (value instanceof ListValue) {
    return value.values.map(mapValue);
  }
  if (value instanceof DictionaryValue) {
    const result = {};
    value.map.forEach((v, k) => {
      result[k] = mapValue(v);
    });
    return result;
  }
  if (value instanceof TupleValue) {
    return value.values.map(mapValue);
  }
  if (value instanceof ScriptValue) {
    return value.script;
  }
  if (value instanceof QualifiedValue) {
    return {
      source: mapValue(value.source),
      selectors: value.selectors.map(mapSelector),
    };
  }
  throw new Error("CANTHAPPEN");
};
const mapSelector = (selector: Selector) => {
  if (selector instanceof IndexedSelector) {
    return { index: mapValue(selector.index) };
  }
  if (selector instanceof KeyedSelector) {
    return { keys: selector.keys.map(mapValue) };
  }
  if (selector instanceof GenericSelector) {
    return { rules: selector.rules.map(mapValue) };
  }
  return { custom: selector };
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

class IntCommand implements Command {
  execute(args: Value[]): Result {
    return OK(args[0]);
  }
}
const INT_CMD = new IntCommand();
class MockCommandResolver implements CommandResolver {
  resolve(name: Value): Command {
    if (name.type == ValueType.INTEGER || !isNaN(parseInt(asString(name))))
      return INT_CMD;
    return this.commands.get(asString(name));
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
  resolve(rules: Value[]): Result<Selector> {
    return this.builder(rules);
  }
  builder: (rules) => Result<Selector> = () => OK(NIL, undefined);
  register(builder: (rules) => Result<Selector>) {
    this.builder = builder;
  }
}

for (const klass of [InlineEvaluator, CompilingEvaluator]) {
  describe(klass.name, () => {
    let tokenizer: Tokenizer;
    let parser: Parser;
    let variableResolver: MockVariableResolver;
    let commandResolver: MockCommandResolver;
    let selectorResolver: MockSelectorResolver;

    let evaluator: Evaluator;

    const parse = (script: string) =>
      parser.parse(tokenizer.tokenize(script)).script;
    const firstSentence = (script: Script) => script.sentences[0];
    const firstWord = (script: Script) =>
      firstSentence(script).words[0] as Word;
    const firstMorpheme = (script: Script) => firstWord(script).morphemes[0];

    beforeEach(() => {
      tokenizer = new Tokenizer();
      parser = new Parser();
      variableResolver = new MockVariableResolver();
      commandResolver = new MockCommandResolver();
      selectorResolver = new MockSelectorResolver();
      evaluator = new klass(
        variableResolver,
        commandResolver,
        selectorResolver
      );
    });

    if (klass == InlineEvaluator) {
      let evaluator: InlineEvaluator;
      beforeEach(() => {
        evaluator = new InlineEvaluator(
          variableResolver,
          commandResolver,
          selectorResolver
        );
      });

      describe("morphemes", () => {
        describe("literals", () => {
          it("evaluate to themselves", () => {
            const morpheme = firstMorpheme(parse("word"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("word");
          });
        });

        describe("tuples", () => {
          specify("empty tuple", () => {
            const morpheme = firstMorpheme(parse("()"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql([]);
          });
          specify("tuple with one literal", () => {
            const morpheme = firstMorpheme(parse("( literal )"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql(["literal"]);
          });
          specify("tuple with two literals", () => {
            const morpheme = firstMorpheme(parse("( lit1 lit2 )"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql(["lit1", "lit2"]);
          });
          specify("2-level tuple", () => {
            const morpheme = firstMorpheme(
              parse("( (lit1 lit2) lit3 (lit4) )")
            );
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql([
              ["lit1", "lit2"],
              "lit3",
              ["lit4"],
            ]);
          });
        });

        describe("blocks", () => {
          it("evaluate to their body parse tree", () => {
            const body = 'a b (c) "d"';
            const morpheme = firstMorpheme(parse(`{${body}}`));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql(parse(body));
          });
        });

        describe("expressions", () => {
          specify("empty expression", () => {
            const morpheme = firstMorpheme(parse("[]"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(value).to.eql(NIL);
          });
          specify("simple command", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => STR("result"))
            );
            const morpheme = firstMorpheme(parse("[cmd]"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("result");
          });
          specify("single argument", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand((args) => args[1])
            );
            const morpheme = firstMorpheme(parse("[cmd arg]"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("arg");
          });
          specify("multiple arguments", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand((args) =>
                STR(args.map((value) => asString(value)).join(""))
              )
            );
            const morpheme = firstMorpheme(parse("[cmd foo bar baz]"));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("cmdfoobarbaz");
          });
          specify("multiple sentences", () => {
            variableResolver.register("var", STR("f"));
            commandResolver.register(
              "cmd",
              new FunctionCommand((args) => TUPLE(args))
            );
            const morpheme = firstMorpheme(
              parse(`[cmd a b; ;
                  
                  ; cmd c d]`)
            );
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql(["cmd", "c", "d"]);
          });
          specify("complex case", () => {
            variableResolver.register("var", STR("f"));
            commandResolver.register(
              "cmd",
              new FunctionCommand((args) => TUPLE(args))
            );
            const morpheme = firstMorpheme(
              parse('[cmd a [cmd b (c d)] "e" $var]')
            );
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
            const morpheme = firstMorpheme(parse('""'));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("");
          });
          specify("simple string", () => {
            const morpheme = firstMorpheme(parse('"this is a string"'));
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("this is a string");
          });

          describe("expressions", () => {
            specify("simple command", () => {
              commandResolver.register(
                "cmd",
                new FunctionCommand(() => STR("is"))
              );
              const morpheme = firstMorpheme(parse('"this [cmd] a string"'));
              const value = evaluator.evaluateMorpheme(morpheme);
              expect(mapValue(value)).to.eql("this is a string");
            });
            specify("multiple commands", () => {
              commandResolver.register(
                "cmd1",
                new FunctionCommand(() => STR("i"))
              );
              commandResolver.register(
                "cmd2",
                new FunctionCommand(() => STR("s"))
              );
              const morpheme = firstMorpheme(
                parse('"this [cmd1][cmd2] a string"')
              );
              const value = evaluator.evaluateMorpheme(morpheme);
              expect(mapValue(value)).to.eql("this is a string");
            });
          });

          describe("variable substitutions", () => {
            describe("scalars", () => {
              specify("simple substitution", () => {
                variableResolver.register("var", STR("value"));
                const morpheme = firstMorpheme(parse('"$var"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("double substitution", () => {
                variableResolver.register("var1", STR("var2"));
                variableResolver.register("var2", STR("value"));
                const morpheme = firstMorpheme(parse('"$$var1"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("triple substitution", () => {
                variableResolver.register("var1", STR("var2"));
                variableResolver.register("var2", STR("var3"));
                variableResolver.register("var3", STR("value"));
                const morpheme = firstMorpheme(parse('"$$$var1"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
            });

            describe("blocks", () => {
              specify("varname with spaces", () => {
                variableResolver.register("variable name", STR("value"));
                const morpheme = firstMorpheme(parse('"${variable name}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("varname with special characters", () => {
                variableResolver.register('variable " " name', STR("value"));
                const morpheme = firstMorpheme(parse('"${variable " " name}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("varname with continuations", () => {
                variableResolver.register("variable name", STR("value"));
                const morpheme = firstMorpheme(
                  parse('"${variable\\\n \t\r     name}"')
                );
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
            });

            describe("expressions", () => {
              specify("simple substitution", () => {
                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("value"))
                );
                const morpheme = firstMorpheme(parse('"$[cmd]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("double substitution", () => {
                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => STR("var"))
                );
                variableResolver.register("var", STR("value"));
                const morpheme = firstMorpheme(parse('"$$[cmd]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
            });

            describe("indexed selectors", () => {
              specify("simple substitution", () => {
                variableResolver.register(
                  "var",
                  LIST([STR("value1"), STR("value2")])
                );
                const morpheme = firstMorpheme(parse('"$var[1]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value2");
              });
              specify("double substitution", () => {
                variableResolver.register("var1", LIST([STR("var2")]));
                variableResolver.register("var2", STR("value"));
                const morpheme = firstMorpheme(parse('"$$var1[0]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("successive indexes", () => {
                variableResolver.register(
                  "var",
                  LIST([
                    STR("value1"),
                    LIST([STR("value2_1"), STR("value2_2")]),
                  ])
                );
                const morpheme = firstMorpheme(parse('"$var[1][0]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value2_1");
              });
              specify("indirect index", () => {
                variableResolver.register(
                  "var1",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                variableResolver.register("var2", STR("1"));
                const morpheme = firstMorpheme(parse('"$var1[$var2]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value2");
              });
              specify("expression", () => {
                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => LIST([STR("value")]))
                );
                const morpheme = firstMorpheme(parse('"$[cmd][0]"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
            });

            describe("keyed selectors", () => {
              specify("simple substitution", () => {
                variableResolver.register("var", DICT({ key: STR("value") }));
                const morpheme = firstMorpheme(parse('"$var(key)"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("double substitution", () => {
                variableResolver.register("var1", DICT({ key: STR("var2") }));
                variableResolver.register("var2", STR("value"));
                const morpheme = firstMorpheme(parse('"$$var1(key)"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("recursive keys", () => {
                variableResolver.register(
                  "var",
                  DICT({
                    key1: DICT({ key2: STR("value") }),
                  })
                );
                const morpheme = firstMorpheme(parse('"$var(key1 key2)"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("successive keys", () => {
                variableResolver.register(
                  "var",
                  DICT({
                    key1: DICT({ key2: STR("value") }),
                  })
                );
                const morpheme = firstMorpheme(parse('"$var(key1)(key2)"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("indirect key", () => {
                variableResolver.register(
                  "var1",
                  DICT({
                    key: STR("value"),
                  })
                );
                variableResolver.register("var2", STR("key"));
                const morpheme = firstMorpheme(parse('"$var1($var2)"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("string key", () => {
                variableResolver.register(
                  "var",
                  DICT({
                    "arbitrary key": STR("value"),
                  })
                );
                const morpheme = firstMorpheme(
                  parse('"$var("arbitrary key")"')
                );
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("expression", () => {
                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() => DICT({ key: STR("value") }))
                );
                const morpheme = firstMorpheme(parse('"$[cmd](key)"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
            });

            describe("custom selectors", () => {
              beforeEach(() => {
                const lastSelector = {
                  apply(value: Value): Result {
                    if (value.select) {
                      return value.select(this);
                    }
                    if (!(value instanceof ListValue))
                      return ERROR("value is not a list");
                    const list = value as ListValue;
                    return OK(list.values[list.values.length - 1]);
                  },
                };
                selectorResolver.register(() => OK(NIL, lastSelector));
              });
              specify("simple substitution", () => {
                variableResolver.register(
                  "var",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                const morpheme = firstMorpheme(parse('"$var{last}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value3");
              });
              specify("double substitution", () => {
                variableResolver.register(
                  "var1",
                  LIST([STR("var2"), STR("var3")])
                );
                variableResolver.register("var3", STR("value"));
                const morpheme = firstMorpheme(parse('"$$var1{last}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value");
              });
              specify("successive selectors", () => {
                variableResolver.register(
                  "var",
                  LIST([
                    STR("value1"),
                    LIST([STR("value2_1"), STR("value2_2")]),
                  ])
                );
                const morpheme = firstMorpheme(parse('"$var{last}{last}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value2_2");
              });
              specify("indirect selector", () => {
                variableResolver.register(
                  "var1",
                  LIST([STR("value1"), STR("value2"), STR("value3")])
                );
                variableResolver.register("var2", STR("last"));
                const morpheme = firstMorpheme(parse('"$var1{$var2}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value3");
              });
              specify("expression", () => {
                commandResolver.register(
                  "cmd",
                  new FunctionCommand(() =>
                    LIST([STR("value1"), STR("value2")])
                  )
                );
                const morpheme = firstMorpheme(parse('"$[cmd]{last}"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("value2");
              });
            });

            describe("compound", () => {
              specify("beginning", () => {
                variableResolver.register("var", DICT({ key: STR("value") }));
                const morpheme = firstMorpheme(parse('"$var(key)foo"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("valuefoo");
              });
              specify("middle", () => {
                variableResolver.register("var", DICT({ key: STR("value") }));
                const morpheme = firstMorpheme(parse('"foo$var(key)bar"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("foovaluebar");
              });
              specify("end", () => {
                variableResolver.register("var", STR("value"));
                const morpheme = firstMorpheme(parse('"foo$var"'));
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("foovalue");
              });
              specify("multiple", () => {
                variableResolver.register(
                  "var1",
                  DICT({ key1: STR("value1") })
                );
                variableResolver.register(
                  "var2",
                  DICT({ key2: STR("value2") })
                );
                const morpheme = firstMorpheme(
                  parse('"foo$var1(key1)bar$var2(key2)baz"')
                );
                const value = evaluator.evaluateMorpheme(morpheme);
                expect(mapValue(value)).to.eql("foovalue1barvalue2baz");
              });
            });
          });

          specify("string with multiple substitutions", () => {
            variableResolver.register("var1", STR("is"));
            variableResolver.register("variable 2", STR("a"));
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => STR("string"))
            );
            const morpheme = firstMorpheme(
              parse('"this $var1 ${variable 2} [cmd] with substitutions"')
            );
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql(
              "this is a string with substitutions"
            );
          });
        });

        describe("here-strings", () => {
          it("evaluate to their content", () => {
            const morpheme = firstMorpheme(
              parse('"""this is a "\'\\ $ \nhere-string"""')
            );
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql("this is a \"'\\ $ \nhere-string");
          });
        });

        describe("tagged strings", () => {
          it("evaluate to their content", () => {
            const morpheme = firstMorpheme(
              parse(
                '""SOME_TAG\nthis is \n a \n "\'\\ $ tagged string\nSOME_TAG""'
              )
            );
            const value = evaluator.evaluateMorpheme(morpheme);
            expect(mapValue(value)).to.eql(
              "this is \n a \n \"'\\ $ tagged string\n"
            );
          });
        });
      });
    }

    describe("words", () => {
      describe("roots", () => {
        specify("literals", () => {
          const word = firstWord(parse("word"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql("word");
        });

        describe("expressions", () => {
          specify("empty expression", () => {
            const word = firstWord(parse("[]"));
            const { value } = evaluator.evaluateWord(word);
            expect(value).to.eql(NIL);
          });
        });
      });

      describe("qualified words", () => {
        describe("scalars", () => {
          specify("indexed selector", () => {
            const word = firstWord(parse("var[123]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql({
              source: "var",
              selectors: [{ index: "123" }],
            });
          });
          specify("keyed selector", () => {
            const word = firstWord(parse("var(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql({
              source: "var",
              selectors: [{ keys: ["key"] }],
            });
          });
          describe("generic selectors", () => {
            beforeEach(() => {
              selectorResolver.register((rules) =>
                GenericSelector.create(rules)
              );
            });
            specify("simple rule", () => {
              const word = firstWord(parse("var{rule}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var",
                selectors: [{ rules: [["rule"]] }],
              });
            });
            specify("rule with literal arguments", () => {
              const word = firstWord(parse("var{rule arg1 arg2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var",
                selectors: [{ rules: [["rule", "arg1", "arg2"]] }],
              });
            });
            specify("multiple rules", () => {
              const word = firstWord(parse("var{rule1;rule2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var",
                selectors: [{ rules: [["rule1"], ["rule2"]] }],
              });
            });
            specify("successive selectors", () => {
              const word = firstWord(parse("var{rule1}{rule2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var",
                selectors: [{ rules: [["rule1"]] }, { rules: [["rule2"]] }],
              });
            });
            specify("indirect selector", () => {
              variableResolver.register("var2", STR("rule"));
              const word = firstWord(parse("var1{$var2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var1",
                selectors: [{ rules: [["rule"]] }],
              });
            });
          });
          describe("custom selectors", () => {
            let lastSelector;
            beforeEach(() => {
              lastSelector = {
                apply(value: Value): Result {
                  if (!(value instanceof ListValue))
                    return ERROR("value is not a list");
                  const list = value as ListValue;
                  return OK(list.values[list.values.length - 1]);
                },
              };
              selectorResolver.register(() => OK(NIL, lastSelector));
            });
            specify("simple rule", () => {
              const word = firstWord(parse("var{last}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var",
                selectors: [{ custom: lastSelector }],
              });
            });
            specify("indirect selector", () => {
              variableResolver.register("var2", STR("last"));
              const word = firstWord(parse("var1{$var2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: "var1",
                selectors: [{ custom: lastSelector }],
              });
            });
          });

          specify("multiple selectors", () => {
            selectorResolver.register((rules) => GenericSelector.create(rules));
            const word = firstWord(
              parse(
                "var(key1 key2 key3){rule1;rule2}[1]{rule3}{rule4}[2](key4)"
              )
            );
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql({
              source: "var",
              selectors: [
                { keys: ["key1", "key2", "key3"] },
                { rules: [["rule1"], ["rule2"]] },
                { index: "1" },
                { rules: [["rule3"]] },
                { rules: [["rule4"]] },
                { index: "2" },
                { keys: ["key4"] },
              ],
            });
          });
          describe("exceptions", () => {
            specify("empty indexed selector", () => {
              const word = firstWord(parse("var[1][]"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("invalid index")
              );
            });
            specify("empty keyed selector", () => {
              const word = firstWord(parse("var(key)()"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("empty selector")
              );
            });
            specify("empty generic selector", () => {
              selectorResolver.register((rules) =>
                GenericSelector.create(rules)
              );
              const word = firstWord(parse("var{rule}{}"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("empty selector")
              );
            });
            specify("invalid trailing morphemes", () => {
              const word = firstWord(parse("var(key1)2"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("invalid word structure")
              );
            });
          });
        });
        describe("tuples", () => {
          specify("indexed selector", () => {
            const word = firstWord(parse("(var1 var2 (var3 var4))[123]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql({
              source: ["var1", "var2", ["var3", "var4"]],
              selectors: [{ index: "123" }],
            });
          });
          specify("keyed selector", () => {
            const word = firstWord(parse("(var1 (var2) var3)(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql({
              source: ["var1", ["var2"], "var3"],
              selectors: [{ keys: ["key"] }],
            });
          });
          describe("generic selectors", () => {
            beforeEach(() => {
              selectorResolver.register((rules) =>
                GenericSelector.create(rules)
              );
            });
            specify("simple rule", () => {
              const word = firstWord(parse("(var1 (var2) var3){rule}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: ["var1", ["var2"], "var3"],
                selectors: [{ rules: [["rule"]] }],
              });
            });
            specify("rule with literal arguments", () => {
              const word = firstWord(
                parse("(var1 (var2) var3){rule arg1 arg2}")
              );
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: ["var1", ["var2"], "var3"],
                selectors: [{ rules: [["rule", "arg1", "arg2"]] }],
              });
            });
            specify("multiple rules", () => {
              const word = firstWord(parse("(var1 (var2) var3){rule1;rule2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: ["var1", ["var2"], "var3"],
                selectors: [{ rules: [["rule1"], ["rule2"]] }],
              });
            });
            specify("successive selectors", () => {
              const word = firstWord(parse("(var1 (var2) var3){rule1}{rule2}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: ["var1", ["var2"], "var3"],
                selectors: [{ rules: [["rule1"]] }, { rules: [["rule2"]] }],
              });
            });
            specify("indirect selector", () => {
              variableResolver.register("var4", STR("rule"));
              const word = firstWord(parse("(var1 (var2) var3){$var4}"));
              const { value } = evaluator.evaluateWord(word);
              expect(mapValue(value)).to.eql({
                source: ["var1", ["var2"], "var3"],
                selectors: [{ rules: [["rule"]] }],
              });
            });
          });
          specify("multiple selectors", () => {
            selectorResolver.register((rules) => GenericSelector.create(rules));
            const word = firstWord(
              parse(
                "((var))(key1 key2 key3){rule1;rule2}[1]{rule3}{rule4}[2](key4)"
              )
            );
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql({
              source: [["var"]],
              selectors: [
                { keys: ["key1", "key2", "key3"] },
                { rules: [["rule1"], ["rule2"]] },
                { index: "1" },
                { rules: [["rule3"]] },
                { rules: [["rule4"]] },
                { index: "2" },
                { keys: ["key4"] },
              ],
            });
          });
          describe("exceptions", () => {
            specify("empty indexed selector", () => {
              const word = firstWord(parse("(var1 var2 (var3 var4))[1][]"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("invalid index")
              );
            });
            specify("empty keyed selector", () => {
              const word = firstWord(parse("(var1 var2 (var3 var4))(key)()"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("empty selector")
              );
            });
            specify("empty generic selector", () => {
              selectorResolver.register((rules) =>
                GenericSelector.create(rules)
              );
              const word = firstWord(parse("(var1 var2 (var3 var4)){rule}{}"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("empty selector")
              );
            });
            specify("invalid trailing morphemes", () => {
              const word = firstWord(parse("(var1 var2)(key1)2"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("invalid word structure")
              );
            });
          });
        });
      });

      describe("substitutions", () => {
        describe("scalars", () => {
          specify("simple substitution", () => {
            variableResolver.register("var", STR("value"));
            const word = firstWord(parse("$var"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", STR("var2"));
            variableResolver.register("var2", STR("value"));
            const word = firstWord(parse("$$var1"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("triple substitution", () => {
            variableResolver.register("var1", STR("var2"));
            variableResolver.register("var2", STR("var3"));
            variableResolver.register("var3", STR("value"));
            const word = firstWord(parse("$$$var1"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("tuples", () => {
          specify("single variable", () => {
            variableResolver.register("var", STR("value"));
            const word = firstWord(parse("$(var)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value"]);
          });
          specify("multiple variables", () => {
            variableResolver.register("var1", STR("value1"));
            variableResolver.register("var2", STR("value2"));
            const word = firstWord(parse("$(var1 var2)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
          specify("double substitution", () => {
            variableResolver.register("var1", STR("var2"));
            variableResolver.register("var2", STR("value"));
            const word = firstWord(parse("$$(var1)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value"]);
          });
          specify("nested tuples", () => {
            variableResolver.register("var1", STR("value1"));
            variableResolver.register("var2", STR("value2"));
            const word = firstWord(parse("$(var1 (var2))"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", ["value2"]]);
          });
          specify("nested double substitution", () => {
            variableResolver.register("var1", STR("var2"));
            variableResolver.register("var2", STR("value"));
            const word = firstWord(parse("$$((var1))"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql([["value"]]);
          });
          specify("nested qualified words", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2")])
            );
            variableResolver.register("var2", DICT({ key: STR("value3") }));
            const word = firstWord(parse("$(var1[0] var2(key))"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value3"]);
          });
        });

        describe("blocks", () => {
          specify("varname with spaces", () => {
            variableResolver.register("variable name", STR("value"));
            const word = firstWord(parse("${variable name}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("varname with special characters", () => {
            variableResolver.register('variable " " name', STR("value"));
            const word = firstWord(parse('${variable " " name}'));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("varname with continuations", () => {
            variableResolver.register("variable name", STR("value"));
            const word = firstWord(parse("${variable\\\n \t\r     name}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
        });

        describe("expressions", () => {
          specify("simple substitution", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => STR("value"))
            );
            const word = firstWord(parse("$[cmd]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution, scalar", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => STR("var"))
            );
            variableResolver.register("var", STR("value"));
            const word = firstWord(parse("$$[cmd]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution, tuple", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => TUPLE([STR("var1"), STR("var2")]))
            );
            variableResolver.register("var1", STR("value1"));
            variableResolver.register("var2", STR("value2"));
            const word = firstWord(parse("$$[cmd]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
        });

        describe("indexed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              LIST([STR("value1"), STR("value2")])
            );
            const word = firstWord(parse("$var[1]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value2");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", LIST([STR("var2")]));
            variableResolver.register("var2", STR("value"));
            const word = firstWord(parse("$$var1[0]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive indexes", () => {
            variableResolver.register(
              "var",
              LIST([STR("value1"), LIST([STR("value2_1"), STR("value2_2")])])
            );
            const word = firstWord(parse("$var[1][0]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value2_1");
          });
          specify("indirect index", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2"), STR("value3")])
            );
            variableResolver.register("var2", STR("1"));
            const word = firstWord(parse("$var1[$var2]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value2");
          });
          specify("command index", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => STR("1"))
            );
            variableResolver.register(
              "var",
              LIST([STR("value1"), STR("value2"), STR("value3")])
            );
            const word = firstWord(parse("$var[cmd]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value2");
          });
          specify("tuple", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2")])
            );
            variableResolver.register(
              "var2",
              LIST([STR("value3"), STR("value4")])
            );
            const word = firstWord(parse("$(var1 var2)[1]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value2", "value4"]);
          });
          specify("recursive tuple", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2")])
            );
            variableResolver.register(
              "var2",
              LIST([STR("value3"), STR("value4")])
            );
            const word = firstWord(parse("$(var1 (var2))[1]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value2", ["value4"]]);
          });
          specify("tuple with double substitution", () => {
            variableResolver.register("var1", LIST([STR("var3"), STR("var4")]));
            variableResolver.register("var2", LIST([STR("var5"), STR("var6")]));
            variableResolver.register("var4", STR("value1"));
            variableResolver.register("var6", STR("value2"));
            const word = firstWord(parse("$$(var1 var2)[1]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
          specify("scalar expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => LIST([STR("value")]))
            );
            const word = firstWord(parse("$[cmd][0]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("tuple expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() =>
                TUPLE([LIST([STR("value1")]), LIST([STR("value2")])])
              )
            );
            const word = firstWord(parse("$[cmd][0]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
        });

        describe("keyed selectors", () => {
          specify("simple substitution", () => {
            variableResolver.register("var", DICT({ key: STR("value") }));
            const word = firstWord(parse("$var(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", DICT({ key: STR("var2") }));
            variableResolver.register("var2", STR("value"));
            const word = firstWord(parse("$$var1(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("recursive keys", () => {
            variableResolver.register(
              "var",
              DICT({
                key1: DICT({ key2: STR("value") }),
              })
            );
            const word = firstWord(parse("$var(key1 key2)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive keys", () => {
            variableResolver.register(
              "var",
              DICT({
                key1: DICT({ key2: STR("value") }),
              })
            );
            const word = firstWord(parse("$var(key1)(key2)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("indirect key", () => {
            variableResolver.register(
              "var1",
              DICT({
                key: STR("value"),
              })
            );
            variableResolver.register("var2", STR("key"));
            const word = firstWord(parse("$var1($var2)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("string key", () => {
            variableResolver.register(
              "var",
              DICT({
                "arbitrary key": STR("value"),
              })
            );
            const word = firstWord(parse('$var("arbitrary key")'));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("block key", () => {
            variableResolver.register(
              "var",
              DICT({
                "arbitrary key": STR("value"),
              })
            );
            const word = firstWord(parse("$var({arbitrary key})"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("tuple", () => {
            variableResolver.register("var1", DICT({ key: STR("value1") }));
            variableResolver.register("var2", DICT({ key: STR("value2") }));
            const word = firstWord(parse("$(var1 var2)(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
          specify("recursive tuple", () => {
            variableResolver.register("var1", DICT({ key: STR("value1") }));
            variableResolver.register("var2", DICT({ key: STR("value2") }));
            const word = firstWord(parse("$(var1 (var2))(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", ["value2"]]);
          });
          specify("tuple with double substitution", () => {
            variableResolver.register("var1", DICT({ key: STR("var3") }));
            variableResolver.register("var2", DICT({ key: STR("var4") }));
            variableResolver.register("var3", STR("value3"));
            variableResolver.register("var4", STR("value4"));
            const word = firstWord(parse("$$(var1 var2)(key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value3", "value4"]);
          });
          specify("scalar expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => DICT({ key: STR("value") }))
            );
            const word = firstWord(parse("$[cmd](key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("tuple expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() =>
                TUPLE([
                  DICT({ key: STR("value1") }),
                  DICT({ key: STR("value2") }),
                ])
              )
            );
            const word = firstWord(parse("$[cmd](key)"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
          describe("exceptions", () => {
            specify("empty selector", () => {
              variableResolver.register("var", DICT({ key: STR("value") }));
              const word = firstWord(parse("$var()"));
              expect(evaluator.evaluateWord(word)).to.eql(
                ERROR("empty selector")
              );
            });
          });
        });

        describe("custom selectors", () => {
          beforeEach(() => {
            const lastSelector = {
              apply(value: Value): Result {
                if (value.select) {
                  return value.select(this);
                }
                if (!(value instanceof ListValue))
                  return ERROR("value is not a list");
                const list = value as ListValue;
                return OK(list.values[list.values.length - 1]);
              },
            };
            selectorResolver.register(() => OK(NIL, lastSelector));
          });
          specify("simple substitution", () => {
            variableResolver.register(
              "var",
              LIST([STR("value1"), STR("value2"), STR("value3")])
            );
            const word = firstWord(parse("$var{last}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value3");
          });
          specify("double substitution", () => {
            variableResolver.register("var1", LIST([STR("var2"), STR("var3")]));
            variableResolver.register("var3", STR("value"));
            const word = firstWord(parse("$$var1{last}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value");
          });
          specify("successive selectors", () => {
            variableResolver.register(
              "var",
              LIST([STR("value1"), LIST([STR("value2_1"), STR("value2_2")])])
            );
            const word = firstWord(parse("$var{last}{last}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value2_2");
          });
          specify("indirect selector", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2"), STR("value3")])
            );
            variableResolver.register("var2", STR("last"));
            const word = firstWord(parse("$var1{$var2}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value3");
          });
          specify("tuple", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2")])
            );
            variableResolver.register(
              "var2",
              LIST([STR("value3"), STR("value4"), STR("value5")])
            );
            const word = firstWord(parse("$(var1 var2){last}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value2", "value5"]);
          });
          specify("recursive tuple", () => {
            variableResolver.register(
              "var1",
              LIST([STR("value1"), STR("value2")])
            );
            variableResolver.register(
              "var2",
              LIST([STR("value3"), STR("value4")])
            );
            const word = firstWord(parse("$(var1 (var2))[1]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value2", ["value4"]]);
          });
          specify("tuple with double substitution", () => {
            variableResolver.register("var1", LIST([STR("var3"), STR("var4")]));
            variableResolver.register("var2", LIST([STR("var5"), STR("var6")]));
            variableResolver.register("var4", STR("value1"));
            variableResolver.register("var6", STR("value2"));
            const word = firstWord(parse("$$(var1 var2)[1]"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql(["value1", "value2"]);
          });
          specify("expression", () => {
            commandResolver.register(
              "cmd",
              new FunctionCommand(() => LIST([STR("value1"), STR("value2")]))
            );
            const word = firstWord(parse("$[cmd]{last}"));
            const { value } = evaluator.evaluateWord(word);
            expect(mapValue(value)).to.eql("value2");
          });
        });

        describe("exceptions", () => {
          specify("unknown variable", () => {
            const word = firstWord(parse("$var"));
            expect(evaluator.evaluateWord(word)).to.eql(
              ERROR('cannot resolve variable "var"')
            );
          });
        });
      });

      describe("ignored words", () => {
        specify("line comments", () => {
          const word = firstWord(parse("# this is a comment"));
          const { value } = evaluator.evaluateWord(word);
          expect(value).to.eql(NIL);
        });
        specify("block comments", () => {
          const word = firstWord(parse("#{ this is\n a\nblock comment }#"));
          const { value } = evaluator.evaluateWord(word);
          expect(value).to.eql(NIL);
        });
      });

      specify("complex case", () => {
        variableResolver.register("var", DICT({ key: STR("value") }));
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) =>
            STR(asString(args[1]) + asString(args[2]))
          )
        );
        const word = firstWord(
          parse("prefix_${var}(key)_infix_[cmd a b]_suffix")
        );
        const { value } = evaluator.evaluateWord(word);
        expect(mapValue(value)).to.eql("prefix_value_infix_ab_suffix");
      });
    });

    describe("word expansion", () => {
      describe("tuple words", () => {
        specify("empty string", () => {
          variableResolver.register("var", STR(""));
          const word = firstWord(parse("(prefix $*var suffix)"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["prefix", "", "suffix"]);
        });
        specify("scalar variable", () => {
          variableResolver.register("var", STR("value"));
          const word = firstWord(parse("(prefix $*var suffix)"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["prefix", "value", "suffix"]);
        });
        specify("empty tuple variable", () => {
          variableResolver.register("var", TUPLE([]));
          const word = firstWord(parse("(prefix $*var suffix)"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["prefix", "suffix"]);
        });
        specify("tuple variable", () => {
          variableResolver.register(
            "var",
            TUPLE([STR("value1"), STR("value2")])
          );
          const word = firstWord(parse("(prefix $*var suffix)"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql([
            "prefix",
            "value1",
            "value2",
            "suffix",
          ]);
        });
        specify("scalar expression", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => STR("value"))
          );
          const word = firstWord(parse("(prefix $*[cmd] suffix)"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["prefix", "value", "suffix"]);
        });
        specify("tuple expression", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand(() => TUPLE([STR("value1"), STR("value2")]))
          );
          const word = firstWord(parse("(prefix $*[cmd] suffix)"));
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql([
            "prefix",
            "value1",
            "value2",
            "suffix",
          ]);
        });
      });
      describe("sentences", () => {
        beforeEach(() => {
          commandResolver.register(
            "cmd",
            new FunctionCommand((args) => TUPLE(args))
          );
        });
        specify("empty string", () => {
          variableResolver.register("var", STR(""));
          const sentence = firstSentence(parse("cmd $*var arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "", "arg"]);
        });
        specify("scalar variable", () => {
          variableResolver.register("var", STR("value"));
          const sentence = firstSentence(parse("cmd $*var arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "value", "arg"]);
        });
        specify("empty tuple variable", () => {
          variableResolver.register("var", TUPLE([]));
          const sentence = firstSentence(parse("cmd $*var arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "arg"]);
        });
        specify("tuple variable", () => {
          variableResolver.register(
            "var",
            TUPLE([STR("value1"), STR("value2")])
          );
          const sentence = firstSentence(parse("cmd $*var arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "value1", "value2", "arg"]);
        });
        specify("multiple variables", () => {
          variableResolver.register("var1", STR("value1"));
          variableResolver.register("var2", STR("value2"));
          const sentence = firstSentence(parse("cmd $*(var1 var2) arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "value1", "value2", "arg"]);
        });
        specify("scalar expression", () => {
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => STR("value"))
          );
          const sentence = firstSentence(parse("cmd $*[cmd2] arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "value", "arg"]);
        });
        specify("tuple expression", () => {
          commandResolver.register(
            "cmd2",
            new FunctionCommand(() => TUPLE([STR("value1"), STR("value2")]))
          );
          const sentence = firstSentence(parse("cmd $*[cmd2] arg"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "value1", "value2", "arg"]);
        });
      });
    });

    describe("comments", () => {
      describe("line comments", () => {
        specify("empty sentence", () => {
          const sentence = firstSentence(parse("# this is a comment"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(value).to.eql(NIL);
        });
        specify("command", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand((args) => TUPLE(args))
          );
          const sentence = firstSentence(parse("cmd arg # this is a comment"));
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "arg"]);
        });
      });
      describe("block comments", () => {
        specify("empty sentence", () => {
          const sentence = firstSentence(
            parse("#{ this is\na\nblock comment }#")
          );
          const { value } = evaluator.evaluateSentence(sentence);
          expect(value).to.eql(NIL);
        });
        specify("command", () => {
          commandResolver.register(
            "cmd",
            new FunctionCommand((args) => TUPLE(args))
          );
          const sentence = firstSentence(
            parse("cmd #{ this is\na\nblock comment }# arg")
          );
          const { value } = evaluator.evaluateSentence(sentence);
          expect(mapValue(value)).to.eql(["cmd", "arg"]);
        });
        specify("tuple", () => {
          const word = firstWord(
            parse("(prefix #{ this is\na\nblock comment }# suffix)")
          );
          const { value } = evaluator.evaluateWord(word);
          expect(mapValue(value)).to.eql(["prefix", "suffix"]);
        });
      });
    });

    describe("scripts", () => {
      specify("conditional evaluation", () => {
        commandResolver.register("if", {
          execute(args) {
            const condition = args[1];
            const block = asString(condition) == "true" ? args[2] : args[4];
            return evaluator.evaluateScript((block as ScriptValue).script);
          },
        });
        const called = {};
        const fn = new FunctionCommand((args) => {
          const cmd = asString(args[0]);
          called[cmd] = called[cmd] ?? 0 + 1;
          return args[1];
        });
        commandResolver.register("cmd1", fn);
        commandResolver.register("cmd2", fn);
        const script1 = parse("if true {cmd1 a} else {cmd2 b}");
        const { value: value1 } = evaluator.evaluateScript(script1);
        expect(mapValue(value1)).to.eql("a");
        expect(called).to.eql({ cmd1: 1 });
        const script2 = parse("if false {cmd1 a} else {cmd2 b}");
        const { value: value2 } = evaluator.evaluateScript(script2);
        expect(mapValue(value2)).to.eql("b");
        expect(called).to.eql({ cmd1: 1, cmd2: 1 });
      });
      specify("loop", () => {
        commandResolver.register(
          "repeat",
          new FunctionCommand((args) => {
            const nb = IntegerValue.toInteger(args[1]).data;
            const block = args[2];
            let value: Value = NIL;
            for (let i = 0; i < nb; i++) {
              value = evaluator.evaluateScript(
                (block as ScriptValue).script
              ).value;
            }
            return value;
          })
        );
        let counter = 0;
        let acc = "";
        commandResolver.register(
          "cmd",
          new FunctionCommand((args) => {
            const value = asString(args[1]);
            acc += value;
            return INT(counter++);
          })
        );
        const script = parse("repeat 10 {cmd foo}");
        const { value } = evaluator.evaluateScript(script);
        expect(mapValue(value)).to.eql(9);
        expect(counter).to.eql(10);
        expect(acc).to.eql("foo".repeat(10));
      });
    });

    describe("result codes", () => {
      describe("return", () => {
        it("should interrupt script evaluation", () => {
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          const script = parse("return a [return b]; return c");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
        it("should interrupt sentence evaluation", () => {
          commandResolver.register("cmd", {
            execute: () => RETURN(STR("value")),
          });
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          const script = parse("cmd [return a [return b]]");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
        it("should interrupt tuple evaluation", () => {
          commandResolver.register("cmd", {
            execute: () => OK(STR("value")),
          });
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          const script = parse("cmd ([return a [return b]])");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
        it("should interrupt expression evaluation", () => {
          commandResolver.register("cmd", {
            execute: () => RETURN(STR("value")),
          });
          commandResolver.register("cmd2", {
            execute: () => {
              throw new Error("CANTHAPPEN");
            },
          });
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          const script = parse("cmd [return a [return b]; cmd2] ");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
        it("should interrupt keyed selector evaluation", () => {
          commandResolver.register("cmd", {
            execute: () => RETURN(STR("value")),
          });
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          variableResolver.register("var", DICT({ key: STR("value") }));
          const script = parse("cmd $var([return a [return b]])");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
        it("should interrupt indexed selector evaluation", () => {
          commandResolver.register("cmd", {
            execute: () => RETURN(STR("value")),
          });
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          variableResolver.register(
            "var",
            LIST([STR("value1"), STR("value2")])
          );
          const script = parse("cmd $var[return a [return b]]");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
        it("should interrupt generic selector evaluation", () => {
          commandResolver.register("cmd", {
            execute: () => RETURN(STR("value")),
          });
          commandResolver.register("return", {
            execute: (args) => RETURN(args[1]),
          });
          variableResolver.register("var", STR("value"));
          const script = parse("cmd $var{[return a [return b]]}");
          const { code, value } = evaluator.evaluateScript(script);
          expect(code).to.eql(ResultCode.RETURN);
          expect(mapValue(value)).to.eql("b");
        });
      });
    });

    describe("command context", () => {
      specify("evaluateScript", () => {
        const script = parse("cmd");

        let commandContext;
        commandResolver.register("cmd", {
          execute: (_args, context) => {
            commandContext = context;
            return OK(NIL);
          },
        });

        const context = Symbol();
        evaluator = new klass(
          variableResolver,
          commandResolver,
          selectorResolver,
          context
        );
        evaluator.evaluateScript(script);
        expect(commandContext).to.equal(context);
      });
      specify("evaluateSentence", () => {
        const script = parse("cmd");
        const sentence = firstSentence(script);

        let commandContext;
        commandResolver.register("cmd", {
          execute: (_args, context) => {
            commandContext = context;
            return OK(NIL);
          },
        });

        const context = Symbol();
        evaluator = new klass(
          variableResolver,
          commandResolver,
          selectorResolver,
          context
        );
        evaluator.evaluateSentence(sentence);
        expect(commandContext).to.equal(context);
      });
      specify("evaluateWord", () => {
        const script = parse("[cmd]");
        const word = firstWord(script);

        let commandContext;
        commandResolver.register("cmd", {
          execute: (_args, context) => {
            commandContext = context;
            return OK(NIL);
          },
        });

        const context = Symbol();
        evaluator = new klass(
          variableResolver,
          commandResolver,
          selectorResolver,
          context
        );
        evaluator.evaluateWord(word);
        expect(commandContext).to.equal(context);
      });
    });

    describe("exceptions", () => {
      specify("invalid command name", () => {
        const script = parse("[]");
        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("invalid command name")
        );
      });
      specify("invalid variable name", () => {
        const script = parse("$([])");
        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("invalid variable name")
        );
      });
      specify("variable substitution with no string representation", () => {
        const script = parse('"$var"');

        variableResolver.register("var", NIL);

        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("value has no string representation")
        );
      });
      specify("command substitution with no string representation", () => {
        const script = parse('"[]"');

        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("value has no string representation")
        );
      });
      specify("no variable resolver", () => {
        const script = parse("$varname");

        evaluator = new klass(null, null, null);
        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("no variable resolver")
        );
      });
      specify("no command resolver", () => {
        const script = parse("cmd");

        evaluator = new klass(null, null, null);
        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("no command resolver")
        );
      });
      specify("no selector resolver", () => {
        const script = parse("varname{last}");

        evaluator = new klass(null, null, null);
        expect(evaluator.evaluateScript(script)).to.eql(
          ERROR("no selector resolver")
        );
      });
    });
  });
}
