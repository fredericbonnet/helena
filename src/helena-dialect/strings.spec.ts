import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, IntegerValue, StringValue, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena strings", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  beforeEach(() => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("string", () => {
    it("should return string value", () => {
      expect(evaluate("string example")).to.eql(new StringValue("example"));
    });
    it("should convert non-string values to strings", () => {
      expect(evaluate("string [+ 1 3]")).to.eql(new StringValue("4"));
    });
    describe("subcommands", () => {
      describe("length", () => {
        it("should return the string length", () => {
          expect(evaluate('string "" length')).to.eql(new IntegerValue(0));
          expect(evaluate("string example length")).to.eql(new IntegerValue(7));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("string example length a")).to.eql(
              ERROR('wrong # args: should be "string value length"')
            );
          });
        });
      });
      describe("at", () => {
        it("should return the character at the given index", () => {
          expect(evaluate("string example at 1")).to.eql(new StringValue("x"));
        });
        it("should return the default value for an out-of-range index", () => {
          expect(evaluate("string example at 10 default")).to.eql(
            new StringValue("default")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("string example at")).to.eql(
              ERROR('wrong # args: should be "string value at index ?default?"')
            );
            expect(execute("string example at a b c")).to.eql(
              ERROR('wrong # args: should be "string value at index ?default?"')
            );
          });
          specify("invalid index", () => {
            expect(execute("string example at a")).to.eql(
              ERROR('invalid integer "a"')
            );
          });
          specify("index out of range", () => {
            expect(execute("string example at -1")).to.eql(
              ERROR('index out of range "-1"')
            );
            expect(execute("string example at 10")).to.eql(
              ERROR('index out of range "10"')
            );
          });
        });
      });
      describe("range", () => {
        it("should return the string included within [first, last]", () => {
          expect(evaluate("string example range 1 3")).to.eql(
            new StringValue("xam")
          );
        });
        it("should return the remainder of the string when given first only", () => {
          expect(evaluate("string example range 2")).to.eql(
            new StringValue("ample")
          );
        });
        it("should truncate out of range boundaries", () => {
          expect(evaluate("string example range -1")).to.eql(
            new StringValue("example")
          );
          expect(evaluate("string example range -10 1")).to.eql(
            new StringValue("ex")
          );
          expect(evaluate("string example range 2 10")).to.eql(
            new StringValue("ample")
          );
          expect(evaluate("string example range -2 10")).to.eql(
            new StringValue("example")
          );
        });
        it("should return an empty string when last is before first", () => {
          expect(evaluate("string example range 2 0")).to.eql(
            new StringValue("")
          );
        });
        it("should return an empty string when first is past the string length", () => {
          expect(evaluate("string example range 10 12")).to.eql(
            new StringValue("")
          );
        });
        it("should return an empty string when last is negative", () => {
          expect(evaluate("string example range -3 -1")).to.eql(
            new StringValue("")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("string example range")).to.eql(
              ERROR('wrong # args: should be "string value range first ?last?"')
            );
            expect(execute("string example range a b c")).to.eql(
              ERROR('wrong # args: should be "string value range first ?last?"')
            );
          });
          specify("invalid index", () => {
            expect(execute("string example range a")).to.eql(
              ERROR('invalid integer "a"')
            );
            expect(execute("string example range 1 b")).to.eql(
              ERROR('invalid integer "b"')
            );
          });
        });
      });
      describe("remove", () => {
        it("should remove the range included within [first, last]", () => {
          expect(evaluate("string example remove 1 3")).to.eql(
            new StringValue("eple")
          );
        });
        it("should truncate out of range boundaries", () => {
          expect(evaluate("string example remove -10 1")).to.eql(
            new StringValue("ample")
          );
          expect(evaluate("string example remove 2 10")).to.eql(
            new StringValue("ex")
          );
          expect(evaluate("string example remove -2 10")).to.eql(
            new StringValue("")
          );
        });
        it("should do nothing when last is before first", () => {
          expect(evaluate("string example remove 2 0")).to.eql(
            new StringValue("example")
          );
        });
        it("should do nothing when last is negative", () => {
          expect(evaluate("string example remove -3 -1")).to.eql(
            new StringValue("example")
          );
        });
        it("should do nothing when first is past the string length", () => {
          expect(evaluate("string example remove 10 12")).to.eql(
            new StringValue("example")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("string example remove a")).to.eql(
              ERROR('wrong # args: should be "string value remove first last"')
            );
            expect(execute("string example remove a b c d")).to.eql(
              ERROR('wrong # args: should be "string value remove first last"')
            );
          });
          specify("invalid index", () => {
            expect(execute("string example remove a b")).to.eql(
              ERROR('invalid integer "a"')
            );
            expect(execute("string example remove 1 b")).to.eql(
              ERROR('invalid integer "b"')
            );
          });
        });
      });
      describe("composition", () => {
        describe("append", () => {
          it("should append two strings", () => {
            expect(evaluate("string example append foo")).to.eql(
              new StringValue("examplefoo")
            );
          });
          it("should accept several strings", () => {
            expect(evaluate("string example append foo bar baz")).to.eql(
              new StringValue("examplefoobarbaz")
            );
          });
          it("should accept zero string", () => {
            expect(evaluate("string example append")).to.eql(
              new StringValue("example")
            );
          });
          describe("exceptions", () => {
            specify("values with no string representation", () => {
              expect(execute("string example append []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example append ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe("insert", () => {
          it("should insert the string at the given index", () => {
            expect(evaluate("string example insert 1 foo")).to.eql(
              new StringValue("efooxample")
            );
          });
          it("should prepend the string when index is negative", () => {
            expect(evaluate("string example insert -10 foo")).to.eql(
              new StringValue("fooexample")
            );
          });
          it("should append the string when index is past the string length", () => {
            expect(evaluate("string example insert 10 foo")).to.eql(
              new StringValue("examplefoo")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string example insert a")).to.eql(
                ERROR('wrong # args: should be "string value insert index new"')
              );
              expect(execute("string example insert a b c")).to.eql(
                ERROR('wrong # args: should be "string value insert index new"')
              );
            });
            specify("invalid index", () => {
              expect(execute("string example insert a b")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example insert 1 []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example insert 1 ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe("replace", () => {
          it("should replace the range included within [first, last] with the given string", () => {
            expect(evaluate("string example replace 1 3 foo")).to.eql(
              new StringValue("efoople")
            );
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("string example replace -10 1 foo")).to.eql(
              new StringValue("fooample")
            );
            expect(evaluate("string example replace 2 10 foo")).to.eql(
              new StringValue("exfoo")
            );
            expect(evaluate("string example replace -2 10 foo")).to.eql(
              new StringValue("foo")
            );
          });
          it("should insert the string at first index when last is before first", () => {
            expect(evaluate("string example replace 2 0 foo")).to.eql(
              new StringValue("exfooample")
            );
          });
          it("should prepend the string when last is negative", () => {
            expect(evaluate("string example replace -3 -1 foo")).to.eql(
              new StringValue("fooexample")
            );
          });
          it("should append the string when first is past the string length", () => {
            expect(evaluate("string example replace 10 12 foo")).to.eql(
              new StringValue("examplefoo")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string example replace a b")).to.eql(
                ERROR(
                  'wrong # args: should be "string value replace first last new"'
                )
              );
              expect(execute("string example replace a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "string value replace first last new"'
                )
              );
            });
            specify("invalid index", () => {
              expect(execute("string example replace a b c")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("string example replace 1 b c")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example replace 1 3 []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example replace 1 3 ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
      });
      describe("comparisons", () => {
        describe("==", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example == foo")).to.equal(FALSE);
            expect(evaluate("string example == example")).to.equal(TRUE);
            expect(evaluate("set var example; string $var == $var")).to.equal(
              TRUE
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string a ==")).to.eql(
                ERROR('wrong # operands: should be "string value1 == value2"')
              );
              expect(execute("string a == b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 == value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example == []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example == ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe("!=", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example != foo")).to.equal(TRUE);
            expect(evaluate("string example != example")).to.equal(FALSE);
            expect(evaluate("set var example; string $var != $var")).to.equal(
              FALSE
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string a !=")).to.eql(
                ERROR('wrong # operands: should be "string value1 != value2"')
              );
              expect(execute("string a != b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 != value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example != []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example != ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe(">", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example > foo")).to.equal(FALSE);
            expect(evaluate("string example > example")).to.equal(FALSE);
            expect(evaluate("set var example; string $var > $var")).to.equal(
              FALSE
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string a >")).to.eql(
                ERROR('wrong # operands: should be "string value1 > value2"')
              );
              expect(execute("string a > b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 > value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example > []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example > ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe(">=", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example >= foo")).to.equal(FALSE);
            expect(evaluate("string example >= example")).to.equal(TRUE);
            expect(evaluate("set var example; string $var >= $var")).to.equal(
              TRUE
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string a >=")).to.eql(
                ERROR('wrong # operands: should be "string value1 >= value2"')
              );
              expect(execute("string a >= b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 >= value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example >= []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example >= ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe("<", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example < foo")).to.equal(TRUE);
            expect(evaluate("string example < example")).to.equal(FALSE);
            expect(evaluate("set var example; string $var < $var")).to.equal(
              FALSE
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string a <")).to.eql(
                ERROR('wrong # operands: should be "string value1 < value2"')
              );
              expect(execute("string a < b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 < value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example < []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example < ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
        describe("<=", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example <= foo")).to.equal(TRUE);
            expect(evaluate("string example <= example")).to.equal(TRUE);
            expect(evaluate("set var example; string $var <= $var")).to.equal(
              TRUE
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("string a <=")).to.eql(
                ERROR('wrong # operands: should be "string value1 <= value2"')
              );
              expect(execute("string a <= b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 <= value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example <= []")).to.eql(
                ERROR("nil has no string representation")
              );
              expect(execute("string example <= ()")).to.eql(
                ERROR("tuples have no string representation")
              );
            });
          });
        });
      });
      it("should be extensible", () => {
        evaluate(
          `[string] eval {
            macro last {value} {
              string $value at [- [string $value length] 1]
            }
          }`
        );
        expect(evaluate("string example last")).to.eql(new StringValue("e"));
      });
      describe("exceptions", () => {
        specify("non-existing subcommand", () => {
          expect(execute('string "" unknownSubcommand')).to.eql(
            ERROR('invalid subcommand name "unknownSubcommand"')
          );
        });
      });
    });
    describe("exceptions", () => {
      specify("values with no string representation", () => {
        expect(execute("string []")).to.eql(
          ERROR("nil has no string representation")
        );
        expect(execute("string ()")).to.eql(
          ERROR("tuples have no string representation")
        );
      });
    });
  });

  describe("currying", () => {
    specify("identity", () => {
      evaluate("set s (string example)");
      expect(evaluate("$s")).to.eql(new StringValue("example"));
    });
    specify("length", () => {
      evaluate("set s (string example)");
      expect(evaluate("$s length")).to.eql(new IntegerValue(7));
    });
    specify("at", () => {
      evaluate("set s (string example)");
      expect(evaluate("$s at 2")).to.eql(new StringValue("a"));
    });
    specify("range", () => {
      evaluate("set s (string example)");
      expect(evaluate("$s range 3 5")).to.eql(new StringValue("mpl"));
    });
    specify("==", () => {
      evaluate("set s (string example)");
      expect(evaluate("$s == value")).to.eql(FALSE);
      expect(evaluate("$s == example")).to.eql(TRUE);
    });
  });

  specify("at <-> indexed selector equivalence", () => {
    rootScope.setVariable("v", new StringValue("example"));
    evaluate("set s (string $v)");

    expect(execute("string $v at 2")).to.eql(execute("idem $v[2]"));
    expect(execute("$s at 2")).to.eql(execute("idem $v[2]"));
    expect(execute("idem $[$s][2]")).to.eql(execute("idem $v[2]"));

    expect(execute("string $v at -1")).to.eql(execute("idem $v[-1]"));
    expect(execute("$s at -1")).to.eql(execute("idem $v[-1]"));
    expect(execute("idem $[$s][-1]")).to.eql(execute("idem $v[-1]"));
  });
});
