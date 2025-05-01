import { expect } from "chai";
import { Command } from "../../core/commands";
import { Compiler, Executor } from "../../core/compiler";
import { CommandResolver, VariableResolver } from "../../core/resolvers";
import { Parser } from "../../core/parser";
import { ERROR } from "../../core/results";
import { Script } from "../../core/syntax";
import { Tokenizer } from "../../core/tokenizer";
import {
  FALSE,
  INT,
  LIST,
  DICT,
  NIL,
  STR,
  TRUE,
  Value,
  StringValue,
  isCustomValue,
} from "../../core/values";
import { regexpCmd, RegExpValue, regexpValueType } from "./regexp";

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

describe("Javascript RegExp", () => {
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

  describe("javascript:RegExpValue", () => {
    specify("type should be custom", () => {
      const value = new RegExpValue(/./);
      expect(isCustomValue(value, regexpValueType)).to.be.true;
    });
    specify("display", () => {
      const re = new RegExp("");
      const value = new RegExpValue(re);
      expect(value.display()).to.eql(`{#{RegExp ${re}}#}`);
    });
  });

  describe("javascript:RegExp", () => {
    beforeEach(() => {
      commandResolver.register("javascript:RegExp", regexpCmd);
    });
    describe("Constructor", () => {
      describe("`new`", () => {
        it("should return a RegexpValue", () => {
          expect(
            isCustomValue(evaluate('javascript:RegExp new ""'), regexpValueType)
          ).to.be.true;
          expect(
            isCustomValue(
              evaluate('javascript:RegExp new "" ""'),
              regexpValueType
            )
          ).to.be.true;
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp new")).to.eql(
              ERROR('wrong # args: should be "RegExp new pattern ?flags?"')
            );
            expect(execute("javascript:RegExp new a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp new pattern ?flags?"')
            );
          });
          specify("invalid pattern value", () => {
            expect(execute("javascript:RegExp new []")).to.eql(
              ERROR("invalid pattern value")
            );
          });
          specify("invalid flags value", () => {
            expect(execute('javascript:RegExp new "" []')).to.eql(
              ERROR("invalid flags value")
            );
          });
          specify("invalid regular expression", () => {
            let message;
            try {
              /* eslint-disable-next-line */
              new RegExp("(");
            } catch (e) {
              message = e.message;
            }
            expect(execute('javascript:RegExp new "("')).to.eql(ERROR(message));
          });
          specify("invalid flags", () => {
            let message;
            try {
              /* eslint-disable-next-line */
              new RegExp("", "gg");
            } catch (e) {
              message = e.message;
            }
            expect(execute('javascript:RegExp new "" gg')).to.eql(
              ERROR(message)
            );
          });
        });
      });
    });

    describe("Instance methods", () => {
      describe("exec", () => {
        specify("MDN demo", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec#try_it
          variableResolver.register(
            "regex1",
            evaluate('javascript:RegExp new "foo*" "g"')
          );
          const str1 = STR("table football, foosball");
          variableResolver.register("str1", str1);

          expect(evaluate("javascript:RegExp exec $regex1 $str1")).to.eql(
            DICT({
              matches: LIST([STR("foo")]),
              index: INT(6),
              input: str1,
              groups: NIL,
            })
          );
          expect(evaluate("javascript:RegExp lastIndex $regex1")).to.eql(
            INT(9)
          );
          expect(evaluate("javascript:RegExp exec $regex1 $str1")).to.eql(
            DICT({
              matches: LIST([STR("foo")]),
              index: INT(16),
              input: str1,
              groups: NIL,
            })
          );
          expect(evaluate("javascript:RegExp lastIndex $regex1")).to.eql(
            INT(19)
          );
          expect(evaluate("javascript:RegExp exec $regex1 $str1")).to.eql(NIL);
        });
        specify("MD example #1", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec#using_exec
          variableResolver.register(
            "re",
            evaluate(
              'javascript:RegExp new "quick\\\\s(?<color>brown).+?(jumps)" "dgi"'
            )
          );
          const result = evaluate(
            'javascript:RegExp exec $re "The Quick Brown Fox Jumps Over The Lazy Dog"'
          );

          expect(result).to.eql(
            DICT({
              matches: LIST([
                STR("Quick Brown Fox Jumps"),
                STR("Brown"),
                STR("Jumps"),
              ]),
              index: INT(4),
              indices: LIST([
                LIST([INT(4), INT(25)]),
                LIST([INT(10), INT(15)]),
                LIST([INT(20), INT(25)]),
              ]),
              "indices.groups": DICT({
                color: LIST([INT(10), INT(15)]),
              }),
              input: STR("The Quick Brown Fox Jumps Over The Lazy Dog"),
              groups: DICT({ color: STR("Brown") }),
            })
          );
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp exec a")).to.eql(
              ERROR('wrong # args: should be "RegExp exec regexp str"')
            );
            expect(execute("javascript:RegExp exec a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp exec regexp str"')
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp exec a b")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute("javascript:RegExp exec [javascript:RegExp new {}] []")
            ).to.eql(ERROR("value has no string representation"));
          });
        });
      });
      describe("`test`", () => {
        specify("MDN demo", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec#try_it
          variableResolver.register("str", STR("table football"));
          variableResolver.register(
            "regex",
            evaluate('javascript:RegExp new "foo*"')
          );
          variableResolver.register(
            "globalRegex",
            evaluate('javascript:RegExp new "foo*" "g"')
          );

          expect(evaluate("javascript:RegExp test $regex $str")).to.eql(TRUE);
          expect(evaluate("javascript:RegExp lastIndex $globalRegex")).to.eql(
            INT(0)
          );
          expect(evaluate("javascript:RegExp test $globalRegex $str")).to.eql(
            TRUE
          );
          expect(evaluate("javascript:RegExp lastIndex $globalRegex")).to.eql(
            INT(9)
          );
          expect(evaluate("javascript:RegExp test $globalRegex $str")).to.eql(
            FALSE
          );
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp test a")).to.eql(
              ERROR('wrong # args: should be "RegExp test regexp str"')
            );
            expect(execute("javascript:RegExp test a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp test regexp str"')
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp test a b")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute("javascript:RegExp test [javascript:RegExp new {}] []")
            ).to.eql(ERROR("value has no string representation"));
          });
        });
      });
      describe("`toString`", () => {
        specify("MDN demo", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/toString#try_it
          expect(
            evaluate(
              `javascript:RegExp toString [javascript:RegExp new "a+b+c"]`
            )
          ).to.eql(STR("/a+b+c/"));
          expect(
            evaluate(
              `javascript:RegExp toString [javascript:RegExp new "bar" "g"]`
            )
          ).to.eql(STR("/bar/g"));
          expect(
            evaluate(
              `javascript:RegExp toString [javascript:RegExp new "\n" "g"]`
            )
          ).to.eql(STR("/\\n/g"));
          expect(
            evaluate(
              `javascript:RegExp toString [javascript:RegExp new "\\n" "g"]`
            )
          ).to.eql(STR("/\\n/g"));
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp toString")).to.eql(
              ERROR('wrong # args: should be "RegExp toString regexp"')
            );
            expect(execute("javascript:RegExp toString a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp toString regexp"')
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp toString a")).to.eql(
              ERROR("invalid regexp value")
            );
          });
        });
      });
      describe("`Symbol.match`", () => {
        specify("MDN examples", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.match#examples
          variableResolver.register(
            "re",
            evaluate('javascript:RegExp new """[0-9]+""" g')
          );
          const str = STR("2016-01-02");
          variableResolver.register("str", str);

          const result = evaluate("javascript:RegExp Symbol.match $re $str");
          expect(result).to.eql(
            DICT({
              matches: LIST([STR("2016"), STR("01"), STR("02")]),
              index: NIL,
              input: NIL,
              groups: NIL,
            })
          );
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp Symbol.match a")).to.eql(
              ERROR('wrong # args: should be "RegExp Symbol.match regexp str"')
            );
            expect(execute("javascript:RegExp Symbol.match a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp Symbol.match regexp str"')
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp Symbol.match a b")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute(
                "javascript:RegExp Symbol.match [javascript:RegExp new {}] []"
              )
            ).to.eql(ERROR("value has no string representation"));
          });
        });
      });
      describe("`Symbol.matchAll`", () => {
        specify("MDN examples", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.matchAll#examples
          variableResolver.register(
            "re",
            evaluate('javascript:RegExp new """[0-9]+""" g')
          );
          const str = STR("2016-01-02");
          variableResolver.register("str", str);

          const result = evaluate("javascript:RegExp Symbol.matchAll $re $str");
          expect(result).to.eql(
            LIST([
              DICT({
                matches: LIST([STR("2016")]),
                index: INT(0),
                input: str,
                groups: NIL,
              }),
              DICT({
                matches: LIST([STR("01")]),
                index: INT(5),
                input: str,
                groups: NIL,
              }),
              DICT({
                matches: LIST([STR("02")]),
                index: INT(8),
                input: str,
                groups: NIL,
              }),
            ])
          );
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp Symbol.matchAll a")).to.eql(
              ERROR(
                'wrong # args: should be "RegExp Symbol.matchAll regexp str"'
              )
            );
            expect(execute("javascript:RegExp Symbol.matchAll a b c")).to.eql(
              ERROR(
                'wrong # args: should be "RegExp Symbol.matchAll regexp str"'
              )
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp Symbol.matchAll a b")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute(
                "javascript:RegExp Symbol.matchAll [javascript:RegExp new {}] []"
              )
            ).to.eql(ERROR("value has no string representation"));
          });
        });
      });
      describe("`Symbol.replace`", () => {
        specify("MDN examples", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.replace#examples
          variableResolver.register(
            "re",
            evaluate('javascript:RegExp new "-" g')
          );
          const str = STR("2016-01-01");
          variableResolver.register("str", str);

          const result = evaluate(
            'javascript:RegExp Symbol.replace $re $str "."'
          );
          expect(result).to.eql(STR("2016.01.01"));
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp Symbol.replace a b")).to.eql(
              ERROR(
                'wrong # args: should be "RegExp Symbol.replace regexp str replacement"'
              )
            );
            expect(execute("javascript:RegExp Symbol.replace a b c d")).to.eql(
              ERROR(
                'wrong # args: should be "RegExp Symbol.replace regexp str replacement"'
              )
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp Symbol.replace a b c")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute(
                "javascript:RegExp Symbol.replace [javascript:RegExp new {}] [] []"
              )
            ).to.eql(ERROR("value has no string representation"));
            expect(
              execute(
                "javascript:RegExp Symbol.replace [javascript:RegExp new {}] a []"
              )
            ).to.eql(ERROR("value has no string representation"));
          });
        });
      });
      describe("`Symbol.search`", () => {
        specify("MDN examples", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.search#examples
          variableResolver.register(
            "re",
            evaluate('javascript:RegExp new "-" g')
          );
          const str = STR("2016-01-02");
          variableResolver.register("str", str);

          const result = evaluate("javascript:RegExp Symbol.search $re $str");
          expect(result).to.eql(INT(4));
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp Symbol.search a")).to.eql(
              ERROR('wrong # args: should be "RegExp Symbol.search regexp str"')
            );
            expect(execute("javascript:RegExp Symbol.search a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp Symbol.search regexp str"')
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp Symbol.search a b")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute(
                "javascript:RegExp Symbol.search [javascript:RegExp new {}] []"
              )
            ).to.eql(ERROR("value has no string representation"));
          });
        });
      });
      describe("`Symbol.split`", () => {
        specify("MDN examples", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.split#examples
          variableResolver.register(
            "re",
            evaluate('javascript:RegExp new "-" g')
          );
          const str = STR("2016-01-02");
          variableResolver.register("str", str);

          const result = evaluate("javascript:RegExp Symbol.split $re $str");
          expect(result).to.eql(LIST([STR("2016"), STR("01"), STR("02")]));
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp Symbol.split a")).to.eql(
              ERROR(
                'wrong # args: should be "RegExp Symbol.split regexp str ?limit?"'
              )
            );
            expect(execute("javascript:RegExp Symbol.split a b c d")).to.eql(
              ERROR(
                'wrong # args: should be "RegExp Symbol.split regexp str ?limit?"'
              )
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp Symbol.split a b")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid string value", () => {
            expect(
              execute(
                "javascript:RegExp Symbol.split [javascript:RegExp new {}] []"
              )
            ).to.eql(ERROR("value has no string representation"));
          });
          specify("invalid limit value", () => {
            expect(
              execute(
                "javascript:RegExp Symbol.split [javascript:RegExp new {}] a b"
              )
            ).to.eql(ERROR('invalid integer "b"'));
          });
        });
      });
    });

    describe("Instance properties", () => {
      describe("`lastIndex`", () => {
        specify("initial", () => {
          expect(
            evaluate("javascript:RegExp lastIndex [javascript:RegExp new {}]")
          ).to.eql(INT(0));
        });
        specify("set value", () => {
          variableResolver.register(
            "regex",
            evaluate('javascript:RegExp new "foo" "g"')
          );
          expect(evaluate("javascript:RegExp lastIndex $regex")).to.eql(INT(0));
          expect(evaluate("javascript:RegExp lastIndex $regex 1234")).to.eql(
            INT(1234)
          );
          expect(evaluate("javascript:RegExp lastIndex $regex")).to.eql(
            INT(1234)
          );
        });
        specify("MDN demo", () => {
          // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec#try_it
          variableResolver.register(
            "regex1",
            evaluate('javascript:RegExp new "foo" "g"')
          );
          variableResolver.register("str1", STR("table football, foosball"));

          evaluate("javascript:RegExp test $regex1 $str1");

          expect(evaluate("javascript:RegExp lastIndex $regex1")).to.eql(
            INT(9)
          );

          evaluate("javascript:RegExp test $regex1 $str1");

          expect(evaluate("javascript:RegExp lastIndex $regex1")).to.eql(
            INT(19)
          );
        });
        describe("Exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("javascript:RegExp lastIndex")).to.eql(
              ERROR('wrong # args: should be "RegExp lastIndex regexp ?value?"')
            );
            expect(execute("javascript:RegExp lastIndex a b c")).to.eql(
              ERROR('wrong # args: should be "RegExp lastIndex regexp ?value?"')
            );
          });
          specify("invalid regexp value", () => {
            expect(execute("javascript:RegExp lastIndex a")).to.eql(
              ERROR("invalid regexp value")
            );
          });
          specify("invalid index value", () => {
            expect(
              execute(
                "javascript:RegExp lastIndex [javascript:RegExp new {}] b"
              )
            ).to.eql(ERROR('invalid integer "b"'));
          });
        });
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("javascript:RegExp")).to.eql(
          ERROR('wrong # args: should be "RegExp method ?arg ...?"')
        );
      });
      specify("unknown method", () => {
        expect(execute("javascript:RegExp unknownMethod")).to.eql(
          ERROR('unknown method "unknownMethod"')
        );
      });
    });
  });
});
