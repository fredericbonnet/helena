import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, INT, STR, StringValue, TRUE, ValueType } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock, describeCommand, specifyExample } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena strings", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  const init = () => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  };
  const usage = (script: string) => {
    init();
    return codeBlock(asString(evaluate("help " + script)));
  };
  const example = specifyExample(({ script }) => execute(script));

  beforeEach(init);

  mochadoc.meta({ toc: true });

  describeCommand("string", () => {
    mochadoc.summary("String handling");
    mochadoc.usage(usage("string"));
    mochadoc.description(() => {
      /**
       * The `string` command is a type command dedicated to string values. It
       * provides an ensemble of subcommands for string creation, conversion,
       * access, and operations.
       *
       * String values are Helena values whose internal type is `STRING`.
       */
    });

    mochadoc.section("String creation and conversion", () => {
      mochadoc.description(() => {
        /**
         * Like with most type commands, passing a single argument to `string`
         * will ensure a string value in return. This property means that
         * `string` can be used for creation and conversion, but also as a type
         * guard in argspecs.
         */
      });

      it("should return string value", () => {
        expect(evaluate("string example")).to.eql(STR("example"));
      });
      it("should convert non-string values to strings", () => {
        /**
         * Any value having a valid string representation can be used.
         */
        expect(evaluate("string [+ 1 3]")).to.eql(STR("4"));
      });

      describe("Exceptions", () => {
        specify("values with no string representation", () => {
          expect(execute("string []")).to.eql(
            ERROR("value has no string representation")
          );
          expect(execute("string ()")).to.eql(
            ERROR("value has no string representation")
          );
        });
      });
    });

    mochadoc.section("Subcommands", () => {
      mochadoc.description(() => {
        /**
         * The `string` ensemble comes with a number of predefined subcommands
         * listed here.
         */
      });

      mochadoc.section("Introspection", () => {
        describe("`subcommands`", () => {
          mochadoc.description(usage('string "" subcommands'));
          mochadoc.description(() => {
            /**
             * This subcommand is useful for introspection and interactive
             * calls.
             */
          });

          specify("usage", () => {
            expect(evaluate('help string "" subcommands')).to.eql(
              STR("string value subcommands")
            );
          });

          it("should return list of subcommands", () => {
            expect(evaluate('string "" subcommands')).to.eql(
              evaluate(
                "list (subcommands length at range append remove insert replace == != > >= < <=)"
              )
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute('string "" subcommands a')).to.eql(
                ERROR('wrong # args: should be "string value subcommands"')
              );
              expect(execute('help string "" subcommands a')).to.eql(
                ERROR('wrong # args: should be "string value subcommands"')
              );
            });
          });
        });
      });

      mochadoc.section("Accessors", () => {
        describe("`length`", () => {
          mochadoc.summary("Get string length");
          mochadoc.description(usage('string "" length'));

          specify("usage", () => {
            expect(evaluate('help string "" length')).to.eql(
              STR("string value length")
            );
          });

          it("should return the string length", () => {
            expect(evaluate('string "" length')).to.eql(INT(0));
            expect(evaluate("string example length")).to.eql(INT(7));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string example length a")).to.eql(
                ERROR('wrong # args: should be "string value length"')
              );
              expect(execute("help string example length a")).to.eql(
                ERROR('wrong # args: should be "string value length"')
              );
            });
          });
        });

        describe("`at`", () => {
          mochadoc.summary("Get string character");
          mochadoc.description(usage('string "" at'));

          specify("usage", () => {
            expect(evaluate('help string "" at')).to.eql(
              STR("string value at index ?default?")
            );
          });

          it("should return the character at `index`", () => {
            expect(evaluate("string example at 1")).to.eql(STR("x"));
          });
          it("should return the default value for an out-of-range `index`", () => {
            expect(evaluate("string example at 10 default")).to.eql(
              STR("default")
            );
          });
          specify("`at` <-> indexed selector equivalence", () => {
            rootScope.setNamedVariable("v", STR("example"));
            evaluate("set s (string $v)");

            expect(execute("string $v at 2")).to.eql(execute("idem $v[2]"));
            expect(execute("$s at 2")).to.eql(execute("idem $v[2]"));
            expect(execute("idem $[$s][2]")).to.eql(execute("idem $v[2]"));

            expect(execute("string $v at -1")).to.eql(execute("idem $v[-1]"));
            expect(execute("$s at -1")).to.eql(execute("idem $v[-1]"));
            expect(execute("idem $[$s][-1]")).to.eql(execute("idem $v[-1]"));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string example at")).to.eql(
                ERROR(
                  'wrong # args: should be "string value at index ?default?"'
                )
              );
              expect(execute("string example at a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "string value at index ?default?"'
                )
              );
              expect(execute("help string example at a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "string value at index ?default?"'
                )
              );
            });
            specify("invalid `index`", () => {
              expect(execute("string example at a")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("`index` out of range", () => {
              expect(execute("string example at -1")).to.eql(
                ERROR('index out of range "-1"')
              );
              expect(execute("string example at 10")).to.eql(
                ERROR('index out of range "10"')
              );
            });
          });
        });
      });

      mochadoc.section("Operations", () => {
        describe("`range`", () => {
          mochadoc.summary("Extract range of characters from a string");
          mochadoc.description(usage('string "" range'));

          specify("usage", () => {
            expect(evaluate('help string "" range')).to.eql(
              STR("string value range first ?last?")
            );
          });

          it("should return the string included within [`first`, `last`]", () => {
            expect(evaluate("string example range 1 3")).to.eql(STR("xam"));
          });
          it("should return the remainder of the string when given `first` only", () => {
            expect(evaluate("string example range 2")).to.eql(STR("ample"));
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("string example range -1")).to.eql(STR("example"));
            expect(evaluate("string example range -10 1")).to.eql(STR("ex"));
            expect(evaluate("string example range 2 10")).to.eql(STR("ample"));
            expect(evaluate("string example range -2 10")).to.eql(
              STR("example")
            );
          });
          it("should return an empty string when last is before `first`", () => {
            expect(evaluate("string example range 2 0")).to.eql(STR(""));
          });
          it("should return an empty string when `first` is past the string length", () => {
            expect(evaluate("string example range 10 12")).to.eql(STR(""));
          });
          it("should return an empty string when `last` is negative", () => {
            expect(evaluate("string example range -3 -1")).to.eql(STR(""));
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string example range")).to.eql(
                ERROR(
                  'wrong # args: should be "string value range first ?last?"'
                )
              );
              expect(execute("string example range a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "string value range first ?last?"'
                )
              );
              expect(execute("help string example range a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "string value range first ?last?"'
                )
              );
            });
            specify("invalid `index`", () => {
              expect(execute("string example range a")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("string example range 1 b")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
          });
        });

        describe("`remove`", () => {
          mochadoc.summary("Remove range of characters from a string");
          mochadoc.description(usage("list () remove"));

          specify("usage", () => {
            expect(evaluate('help string "" remove')).to.eql(
              STR("string value remove first last")
            );
          });

          it("should remove the range included within [`first`, `last`]", () => {
            expect(evaluate("string example remove 1 3")).to.eql(STR("eple"));
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("string example remove -10 1")).to.eql(
              STR("ample")
            );
            expect(evaluate("string example remove 2 10")).to.eql(STR("ex"));
            expect(evaluate("string example remove -2 10")).to.eql(STR(""));
          });
          it("should do nothing when `last` is before `first`", () => {
            expect(evaluate("string example remove 2 0")).to.eql(
              STR("example")
            );
          });
          it("should do nothing when `last` is negative", () => {
            expect(evaluate("string example remove -3 -1")).to.eql(
              STR("example")
            );
          });
          it("should do nothing when `first` is past the string length", () => {
            expect(evaluate("string example remove 10 12")).to.eql(
              STR("example")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string example remove a")).to.eql(
                ERROR(
                  'wrong # args: should be "string value remove first last"'
                )
              );
              expect(execute("string example remove a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "string value remove first last"'
                )
              );
              expect(execute("help string example remove a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "string value remove first last"'
                )
              );
            });
            specify("invalid `index`", () => {
              expect(execute("string example remove a b")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("string example remove 1 b")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
          });
        });

        describe("`append`", () => {
          mochadoc.summary("Concatenate strings");
          mochadoc.description(usage('string "" append'));

          specify("usage", () => {
            expect(evaluate('help string "" append')).to.eql(
              STR("string value append ?string ...?")
            );
          });

          it("should append two strings", () => {
            expect(evaluate("string example append foo")).to.eql(
              STR("examplefoo")
            );
          });
          it("should accept several strings", () => {
            expect(evaluate("string example append foo bar baz")).to.eql(
              STR("examplefoobarbaz")
            );
          });
          it("should accept zero string", () => {
            expect(evaluate("string example append")).to.eql(STR("example"));
          });

          describe("Exceptions", () => {
            specify("values with no string representation", () => {
              expect(execute("string example append []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example append ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`insert`", () => {
          mochadoc.summary("Insert string into a string");
          mochadoc.description(usage('string "" insert'));

          specify("usage", () => {
            expect(evaluate('help string "" insert')).to.eql(
              STR("string value insert index value2")
            );
          });

          it("should insert `string` at `index`", () => {
            expect(evaluate("string example insert 1 foo")).to.eql(
              STR("efooxample")
            );
          });
          it("should prepend `string` when `index` is negative", () => {
            expect(evaluate("string example insert -10 foo")).to.eql(
              STR("fooexample")
            );
          });
          it("should append `string` when `index` is past the target string length", () => {
            expect(evaluate("string example insert 10 foo")).to.eql(
              STR("examplefoo")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string example insert a")).to.eql(
                ERROR(
                  'wrong # args: should be "string value insert index value2"'
                )
              );
              expect(execute("string example insert a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "string value insert index value2"'
                )
              );
              expect(execute("help string example insert a b c")).to.eql(
                ERROR(
                  'wrong # args: should be "string value insert index value2"'
                )
              );
            });
            specify("invalid `index`", () => {
              expect(execute("string example insert a b")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example insert 1 []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example insert 1 ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`replace`", () => {
          mochadoc.summary("Replace range of characters in a list");
          mochadoc.description(usage('string "" replace'));

          specify("usage", () => {
            expect(evaluate('help string "" replace')).to.eql(
              STR("string value replace first last value2")
            );
          });

          it("should replace the range included within [`first`, `last`] with `string`", () => {
            expect(evaluate("string example replace 1 3 foo")).to.eql(
              STR("efoople")
            );
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("string example replace -10 1 foo")).to.eql(
              STR("fooample")
            );
            expect(evaluate("string example replace 2 10 foo")).to.eql(
              STR("exfoo")
            );
            expect(evaluate("string example replace -2 10 foo")).to.eql(
              STR("foo")
            );
          });
          it("should insert `string` at `first` index when `last` is before `first`", () => {
            expect(evaluate("string example replace 2 0 foo")).to.eql(
              STR("exfooample")
            );
          });
          it("should prepend `string` when `last` is negative", () => {
            expect(evaluate("string example replace -3 -1 foo")).to.eql(
              STR("fooexample")
            );
          });
          it("should append `string` when `first` is past the target string length", () => {
            expect(evaluate("string example replace 10 12 foo")).to.eql(
              STR("examplefoo")
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string example replace a b")).to.eql(
                ERROR(
                  'wrong # args: should be "string value replace first last value2"'
                )
              );
              expect(execute("string example replace a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "string value replace first last value2"'
                )
              );
              expect(execute("help string example replace a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "string value replace first last value2"'
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
                ERROR("value has no string representation")
              );
              expect(execute("string example replace 1 3 ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });
      });

      mochadoc.section("String comparisons", () => {
        mochadoc.description(usage('string "" =='));

        specify("usage", () => {
          expect(evaluate('help string "" ==')).to.eql(
            STR("string value1 == value2")
          );
        });

        describe("`==`", () => {
          it("should compare two strings", () => {
            expect(evaluate("string example == foo")).to.equal(FALSE);
            expect(evaluate("string example == example")).to.equal(TRUE);
            expect(evaluate("set var example; string $var == $var")).to.equal(
              TRUE
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string a ==")).to.eql(
                ERROR('wrong # operands: should be "string value1 == value2"')
              );
              expect(execute("string a == b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 == value2"')
              );
              expect(execute("help string a == b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 == value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example == []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example == ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`!=`", () => {
          mochadoc.description(usage('string "" !='));

          specify("usage", () => {
            expect(evaluate('help string "" !=')).to.eql(
              STR("string value1 != value2")
            );
          });

          it("should compare two strings", () => {
            expect(evaluate("string example != foo")).to.equal(TRUE);
            expect(evaluate("string example != example")).to.equal(FALSE);
            expect(evaluate("set var example; string $var != $var")).to.equal(
              FALSE
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string a !=")).to.eql(
                ERROR('wrong # operands: should be "string value1 != value2"')
              );
              expect(execute("string a != b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 != value2"')
              );
              expect(execute("help string a != b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 != value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example != []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example != ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`>`", () => {
          mochadoc.description(usage('string "" >'));

          specify("usage", () => {
            expect(evaluate('help string "" >')).to.eql(
              STR("string value1 > value2")
            );
          });

          it("should compare two strings", () => {
            expect(evaluate("string example > foo")).to.equal(FALSE);
            expect(evaluate("string example > example")).to.equal(FALSE);
            expect(evaluate("set var example; string $var > $var")).to.equal(
              FALSE
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string a >")).to.eql(
                ERROR('wrong # operands: should be "string value1 > value2"')
              );
              expect(execute("string a > b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 > value2"')
              );
              expect(execute("help string a > b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 > value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example > []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example > ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`>=`", () => {
          mochadoc.description(usage('string "" >='));

          specify("usage", () => {
            expect(evaluate('help string "" >=')).to.eql(
              STR("string value1 >= value2")
            );
          });

          it("should compare two strings", () => {
            expect(evaluate("string example >= foo")).to.equal(FALSE);
            expect(evaluate("string example >= example")).to.equal(TRUE);
            expect(evaluate("set var example; string $var >= $var")).to.equal(
              TRUE
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string a >=")).to.eql(
                ERROR('wrong # operands: should be "string value1 >= value2"')
              );
              expect(execute("string a >= b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 >= value2"')
              );
              expect(execute("help string a >= b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 >= value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example >= []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example >= ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`<`", () => {
          mochadoc.description(usage('string "" <'));

          specify("usage", () => {
            expect(evaluate('help string "" <')).to.eql(
              STR("string value1 < value2")
            );
          });

          it("should compare two strings", () => {
            expect(evaluate("string example < foo")).to.equal(TRUE);
            expect(evaluate("string example < example")).to.equal(FALSE);
            expect(evaluate("set var example; string $var < $var")).to.equal(
              FALSE
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string a <")).to.eql(
                ERROR('wrong # operands: should be "string value1 < value2"')
              );
              expect(execute("string a < b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 < value2"')
              );
              expect(execute("help string a < b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 < value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example < []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example < ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });

        describe("`<=`", () => {
          mochadoc.description(usage('string "" <='));

          specify("usage", () => {
            expect(evaluate('help string "" <=')).to.eql(
              STR("string value1 <= value2")
            );
          });

          it("should compare two strings", () => {
            expect(evaluate("string example <= foo")).to.equal(TRUE);
            expect(evaluate("string example <= example")).to.equal(TRUE);
            expect(evaluate("set var example; string $var <= $var")).to.equal(
              TRUE
            );
          });

          describe("Exceptions", () => {
            specify("wrong arity", () => {
              /**
               * The subcommand will return an error message with usage when
               * given the wrong number of arguments.
               */
              expect(execute("string a <=")).to.eql(
                ERROR('wrong # operands: should be "string value1 <= value2"')
              );
              expect(execute("string a <= b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 <= value2"')
              );
              expect(execute("help string a <= b c")).to.eql(
                ERROR('wrong # operands: should be "string value1 <= value2"')
              );
            });
            specify("values with no string representation", () => {
              expect(execute("string example <= []")).to.eql(
                ERROR("value has no string representation")
              );
              expect(execute("string example <= ()")).to.eql(
                ERROR("value has no string representation")
              );
            });
          });
        });
      });

      mochadoc.section("Exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute('string "" unknownSubcommand')).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute('string "" []')).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
    });

    mochadoc.section("Examples", () => {
      example("Currying and encapsulation", [
        {
          doc: () => {
            /**
             * Thanks to leading tuple auto-expansion, it is very simple to
             * bundle the `string` command and a value into a tuple to create a
             * pseudo-object value. For example:
             */
          },
          script: "set s (string example)",
        },
        {
          doc: () => {
            /**
             * We can then use this variable like a regular command. Calling it
             * without argument will return the wrapped value:
             */
          },
          script: "$s",
          result: STR("example"),
        },
        {
          doc: () => {
            /**
             * Subcommands then behave like object methods:
             */
          },
          script: "$s length",
          result: INT(7),
        },
        {
          script: "$s at 2",
          result: STR("a"),
        },
        {
          script: "$s range 3 5",
          result: STR("mpl"),
        },
        {
          script: "$s == example",
          result: TRUE,
        },
        {
          script: "$s > exercise",
          result: FALSE,
        },
      ]);
      example("Argument type guard", [
        {
          doc: () => {
            /**
             * Calling `string` with a single argument returns its value as a
             * list. This property allows `string` to be used as a type guard
             * for argspecs.
             *
             * Here we create a macro `len` that returns the length of the
             * provided string. Using `string` as guard has three effects:
             *
             * - it validates the argument on the caller side
             * - it converts the value at most once
             * - it ensures type safety within the body
             *
             * Note how using `string` as a guard for argument `s` makes it look
             * like a static type declaration:
             */
          },
          script: "macro len ( (string s) ) {string $s length}",
        },
        {
          doc: () => {
            /**
             * Passing a valid value will give the expected result:
             */
          },
          script: "len example",
          result: INT(7),
        },
        {
          doc: () => {
            /**
             * Passing an invalid value will produce an error:
             */
          },
          script: "len (invalid value)",
          result: ERROR("value has no string representation"),
        },
      ]);
    });

    mochadoc.section("Ensemble command", () => {
      mochadoc.description(() => {
        /**
         * `string` is an ensemble command, which means that it is a collection
         * of subcommands defined in an ensemble scope.
         */
      });

      it("should return its ensemble metacommand when called with no argument", () => {
        /**
         * The typical application of this property is to access the ensemble
         * metacommand by wrapping the command within brackets, i.e. `[string]`.
         */
        expect(evaluate("string").type).to.eql(ValueType.COMMAND);
      });
      it("should be extensible", () => {
        /**
         * Creating a command in the `string` ensemble scope will add it to its
         * subcommands.
         */
        evaluate(`
          [string] eval {
            macro foo {value} {idem bar}
          }
        `);
        expect(evaluate("string example foo")).to.eql(STR("bar"));
      });
      it("should support help for custom subcommands", () => {
        /**
         * Like all ensemble commands, `string` have built-in support for `help`
         * on all subcommands that support it.
         */
        evaluate(`
          [string] eval {
            macro foo {value a b} {idem bar}
          }
        `);
        expect(evaluate("help string example foo")).to.eql(
          STR("string value foo a b")
        );
        expect(execute("help string example foo 1 2 3")).to.eql(
          ERROR('wrong # args: should be "string value foo a b"')
        );
      });

      mochadoc.section("Examples", () => {
        example("Adding a `last` subcommand", [
          {
            doc: () => {
              /**
               * Here we create a `last` macro within the `string` ensemble
               * scope, returning the last character of the provided string
               * value:
               */
            },
            script: `
              [string] eval {
                macro last {value} {
                  string $value at [- [string $value length] 1]
                }
              }
            `,
          },
          {
            doc: () => {
              /**
               * We can then use `last` just like the predefined `string`
               * subcommands:
               */
            },
            script: "string example last",
            result: STR("e"),
          },
        ]);
        example("Adding a `+` operator", [
          {
            doc: () => {
              /**
               * Here we create a `+` binary macro that concatenates two strings
               * together:
               */
            },
            script: `
              [string] eval {
                macro + {str1 str2} {idem $str1$str2}
              }
            `,
          },
          {
            doc: () => {
              /**
               * (Note how we are free to name subcommand arguments however we
               * want)
               *
               * We can then use `+` as an infix concatenate operator:
               */
            },
            script: "string s1 + s2",
            result: STR("s1s2"),
          },
        ]);
      });
    });
  });
});
