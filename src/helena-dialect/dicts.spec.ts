import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import {
  FALSE,
  IntegerValue,
  MapValue,
  NIL,
  StringValue,
  TRUE,
  TupleValue,
} from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena dictionaries", () => {
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

  describe("dict", () => {
    it("should return map value", () => {
      expect(evaluate("dict ()")).to.eql(new MapValue({}));
    });
    it("should convert key-value tuples to maps", () => {
      expect(evaluate("dict (a b c d)")).to.eql(
        new MapValue({
          a: new StringValue("b"),
          c: new StringValue("d"),
        })
      );
    });
    it("should convert key-value blocks to maps", () => {
      expect(evaluate("dict {a b c d}")).to.eql(evaluate("dict (a b c d)"));
    });
    it("should convert key-value lists to maps", () => {
      expect(evaluate("dict [list (a b c d)]")).to.eql(
        evaluate("dict (a b c d)")
      );
    });
    it("should convert non-string keys to strings", () => {
      expect(evaluate("dict ([1] a [2.5] b [true] c {block} d)")).to.eql(
        new MapValue({
          "1": new StringValue("a"),
          "2.5": new StringValue("b"),
          true: new StringValue("c"),
          block: new StringValue("d"),
        })
      );
    });
    it("should preserve values", () => {
      expect(evaluate("dict (a [1] b () c [])")).to.eql(
        new MapValue({
          a: new IntegerValue(1),
          b: new TupleValue([]),
          c: NIL,
        })
      );
    });
    describe("subcommands", () => {
      describe("size", () => {
        it("should return the map size", () => {
          expect(evaluate("dict () size")).to.eql(new IntegerValue(0));
          expect(evaluate("dict (a b c d) size")).to.eql(new IntegerValue(2));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict () size a")).to.eql(
              ERROR('wrong # args: should be "dict value size"')
            );
          });
        });
      });
      describe("has", () => {
        it("should test for key presence", () => {
          expect(evaluate("dict (a b c d) has a")).to.eql(TRUE);
          expect(evaluate("dict (a b c d) has e")).to.eql(FALSE);
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) has")).to.eql(
              ERROR('wrong # args: should be "dict value has key"')
            );
            expect(execute("dict (a b c d) has a b")).to.eql(
              ERROR('wrong # args: should be "dict value has key"')
            );
          });
          specify("invalid key", () => {
            expect(execute("dict (a b c d) has []")).to.eql(
              ERROR("invalid key")
            );
            expect(execute("dict (a b c d) has ()")).to.eql(
              ERROR("invalid key")
            );
          });
        });
      });
      describe("get", () => {
        it("should return the value at the given key", () => {
          expect(evaluate("dict (a b c d) get a")).to.eql(new StringValue("b"));
        });
        it("should return the default value for a non-existing key", () => {
          expect(evaluate("dict (a b c d) get e default")).to.eql(
            new StringValue("default")
          );
        });
        it("should support key tuples", () => {
          expect(evaluate("dict (a b c d e f) get (a e)")).to.eql(
            evaluate("idem (b f)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) get")).to.eql(
              ERROR('wrong # args: should be "dict value get key ?default?"')
            );
            expect(execute("dict (a b c d) get a b c")).to.eql(
              ERROR('wrong # args: should be "dict value get key ?default?"')
            );
          });
          specify("unknow key", () => {
            expect(execute("dict (a b c d) get e")).to.eql(
              ERROR('unknown key "e"')
            );
            expect(execute("dict (a b c d) get (a e)")).to.eql(
              ERROR('unknown key "e"')
            );
          });
          specify("invalid key", () => {
            expect(execute("dict (a b c d) get ([])")).to.eql(
              ERROR("invalid key")
            );
            expect(execute("dict (a b c d) get []")).to.eql(
              ERROR("invalid key")
            );
            expect(execute("dict (a b c d) get [list ()]")).to.eql(
              ERROR("invalid key")
            );
          });
          specify("key tuples with default", () => {
            expect(execute("dict (a b c d) get (a) default")).to.eql(
              ERROR("cannot use default with key tuples")
            );
          });
        });
      });
      describe("add", () => {
        it("should add the value for a new key", () => {
          expect(evaluate("dict (a b c d) add e f")).to.eql(
            evaluate("dict (a b c d e f)")
          );
        });
        it("should replace the value for an existing key", () => {
          expect(evaluate("dict (a b c d) add a e")).to.eql(
            evaluate("dict (a e c d)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) add a")).to.eql(
              ERROR('wrong # args: should be "dict value add key value"')
            );
            expect(execute("dict (a b c d) add a b c")).to.eql(
              ERROR('wrong # args: should be "dict value add key value"')
            );
          });
          specify("invalid key", () => {
            expect(execute("dict (a b c d) add [] b")).to.eql(
              ERROR("invalid key")
            );
            expect(execute("dict (a b c d) add () b")).to.eql(
              ERROR("invalid key")
            );
          });
        });
      });
      describe("remove", () => {
        it("should remove the provided key", () => {
          expect(evaluate("dict (a b c d) remove a")).to.eql(
            evaluate("dict (c d)")
          );
        });
        it("should accept several keys to remove", () => {
          expect(evaluate("dict (a b c d e f) remove a e")).to.eql(
            evaluate("dict (c d)")
          );
        });
        it("should ignore unknown keys", () => {
          expect(evaluate("dict (a b c d e f) remove g")).to.eql(
            evaluate("dict (a b c d e f)")
          );
        });
        it("should accept zero key", () => {
          expect(evaluate("dict (a b c d e f) remove")).to.eql(
            evaluate("dict (a b c d e f)")
          );
        });
        describe("exceptions", () => {
          specify("invalid key", () => {
            expect(execute("dict (a b c d) remove []")).to.eql(
              ERROR("invalid key")
            );
            expect(execute("dict (a b c d) remove ()")).to.eql(
              ERROR("invalid key")
            );
          });
        });
      });
      describe("merge", () => {
        it("should merge two maps", () => {
          expect(evaluate("dict (a b c d) merge (foo bar)")).to.eql(
            evaluate("dict (a b c d foo bar)")
          );
        });
        it("should accept several maps", () => {
          expect(
            evaluate("dict (a b c d) merge (foo bar) (baz sprong)")
          ).to.eql(evaluate("dict (a b c d foo bar baz sprong)"));
        });
        it("should accept zero map", () => {
          expect(evaluate("dict (a b c d) merge")).to.eql(
            evaluate("dict (a b c d)")
          );
        });
        describe("exceptions", () => {
          specify("invalid values", () => {
            expect(execute("dict (a b c d) merge []")).to.eql(
              ERROR("invalid list")
            );
            expect(execute("dict (a b c d) merge [1]")).to.eql(
              ERROR("invalid list")
            );
            expect(execute("dict (a b c d) merge e")).to.eql(
              ERROR("invalid list")
            );
            expect(execute("dict (a b c d) merge (e)")).to.eql(
              ERROR("invalid key-value list")
            );
          });
        });
      });
      describe("keys", () => {
        it("should return the list of keys", () => {
          expect(evaluate("dict (a b c d) keys")).to.eql(
            evaluate("list (a c)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) keys a")).to.eql(
              ERROR('wrong # args: should be "dict value keys"')
            );
          });
        });
      });
      describe("values", () => {
        it("should return the list of values", () => {
          expect(evaluate("dict (a b c d) values")).to.eql(
            evaluate("list (b d)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) values a")).to.eql(
              ERROR('wrong # args: should be "dict value values"')
            );
          });
        });
      });
      describe("entries", () => {
        it("should return the list of key-value tuples", () => {
          expect(evaluate("dict (a b c d) entries")).to.eql(
            evaluate("list ((a b) (c d))")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) entries a")).to.eql(
              ERROR('wrong # args: should be "dict value entries"')
            );
          });
        });
      });
      describe("foreach", () => {
        it("should iterate over entries", () => {
          evaluate(`
            set entries [list ()]
            set d [dict (a b c d e f)]
            dict $d foreach entry {
              set entries [list $entries append ($entry)]
            }
            `);
          expect(evaluate("get entries")).to.eql(evaluate("dict $d entries"));
        });
        describe("entry parameter tuples", () => {
          it("should be supported", () => {
            evaluate(`
            set keys [list ()]
            set values [list ()]
            set d [dict (a b c d e f)]
            dict $d foreach (key value) {
              set keys [list $keys append ($key)]
              set values [list $values append ($value)]
            }
            `);
            expect(evaluate("get keys")).to.eql(evaluate("dict $d keys"));
            expect(evaluate("get values")).to.eql(evaluate("dict $d values"));
          });
          it("should accept empty tuple", () => {
            evaluate(`
              set i 0
              dict (a b c d e f) foreach () {
                set i [+ $i 1]
              }
              `);
            expect(evaluate("get i")).to.eql(new IntegerValue(3));
          });
          it("should accept (key) tuple", () => {
            evaluate(`
              set keys [list ()]
              set d [dict (a b c d e f)]
              dict (a b c d e f) foreach (key) {
                set keys [list $keys append ($key)]
              }
              `);
            expect(evaluate("get keys")).to.eql(evaluate("dict $d keys"));
          });
          it("should ignore extra elements", () => {
            expect(
              execute(`
                dict (a b c d e f) foreach (key value foo) {
                  if [exists foo] {unreachable}
                }
              `)
            ).to.eql(OK(NIL));
          });
        });
        it("should return the result of the last command", () => {
          expect(execute("dict () foreach entry {}")).to.eql(OK(NIL));
          expect(execute("dict (a b) foreach entry {}")).to.eql(OK(NIL));
          expect(
            evaluate(
              "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]}"
            )
          ).to.eql(new IntegerValue(3));
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt the loop with RETURN code", () => {
              expect(
                execute(
                  "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; return $entry; unreachable}"
                )
              ).to.eql(execute("return (a b)"));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("tailcall", () => {
            it("should interrupt the loop with RETURN code", () => {
              expect(
                execute(
                  "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; tailcall {idem $entry}; unreachable}"
                )
              ).to.eql(execute("return (a b)"));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("yield", () => {
            it("should interrupt the body with YIELD code", () => {
              expect(
                execute("dict (a b c d e f) foreach entry {yield; unreachable}")
                  .code
              ).to.eql(ResultCode.YIELD);
            });
            it("should provide a resumable state", () => {
              const process = rootScope.prepareScript(
                parse(
                  "dict (a b c d e f) foreach (key value) {idem _$[yield $key]_}"
                )
              );

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("a"));
              expect(result.data).to.exist;

              process.yieldBack(new StringValue("step 1"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("c"));
              expect(result.data).to.exist;

              process.yieldBack(new StringValue("step 2"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("e"));
              expect(result.data).to.exist;

              process.yieldBack(new StringValue("step 3"));
              result = process.run();
              expect(result).to.eql(OK(new StringValue("_step 3_")));
            });
          });
          describe("error", () => {
            it("should interrupt the loop with ERROR code", () => {
              expect(
                execute(
                  "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; error msg; unreachable}"
                )
              ).to.eql(ERROR("msg"));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("break", () => {
            it("should interrupt the body with nil result", () => {
              expect(
                execute(
                  "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; break; unreachable}"
                )
              ).to.eql(OK(NIL));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("continue", () => {
            it("should interrupt the body iteration", () => {
              expect(
                execute(
                  "set i 0; dict (a b c d e f) foreach entry {set i [+ $i 1]; continue; unreachable}"
                )
              ).to.eql(OK(NIL));
              expect(evaluate("get i")).to.eql(new IntegerValue(3));
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("dict (a b c d) foreach a")).to.eql(
              ERROR('wrong # args: should be "dict value foreach entry body"')
            );
            expect(execute("dict (a b c d) foreach a b c")).to.eql(
              ERROR('wrong # args: should be "dict value foreach entry body"')
            );
          });
          specify("non-script body", () => {
            expect(execute("dict (a b c d) foreach a b")).to.eql(
              ERROR("body must be a script")
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing subcommand", () => {
          expect(execute("dict () unknownSubcommand")).to.eql(
            ERROR('invalid subcommand name "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("dict () []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
      it("should be extensible", () => {
        evaluate(
          `[dict] eval {
            macro foo {value} {
              idem bar$[dict $value size]
            }
          }`
        );
        expect(evaluate("dict (a b c d) foo")).to.eql(new StringValue("bar2"));
      });
    });
    describe("exceptions", () => {
      specify("invalid lists", () => {
        expect(execute("dict []")).to.eql(ERROR("invalid map"));
        expect(execute("dict [1]")).to.eql(ERROR("invalid map"));
        expect(execute("dict a")).to.eql(ERROR("invalid map"));
      });
      specify("invalid keys", () => {
        expect(execute("dict ([] a)")).to.eql(ERROR("invalid key"));
        expect(execute("dict (() a)")).to.eql(ERROR("invalid key"));
      });
      specify("odd lists", () => {
        expect(execute("dict (a)")).to.eql(ERROR("invalid key-value list"));
        expect(execute("dict {a b c}")).to.eql(ERROR("invalid key-value list"));
      });
      specify("blocks with side effects", () => {
        expect(execute("dict { $a b}")).to.eql(ERROR("invalid list"));
        expect(execute("dict { a [b] }")).to.eql(ERROR("invalid list"));
        expect(execute("dict { $[][a] b}")).to.eql(ERROR("invalid list"));
        expect(execute("dict { a $[](b) }")).to.eql(ERROR("invalid list"));
      });
    });
  });

  describe("currying", () => {
    specify("identity", () => {
      evaluate("set d (dict (a b c d))");
      expect(evaluate("$d")).to.eql(evaluate("dict (a b c d)"));
    });
    specify("size", () => {
      evaluate("set d (dict (a b c d))");
      expect(evaluate("$d size")).to.eql(new IntegerValue(2));
    });
    specify("get", () => {
      evaluate("set d (dict (a b c d))");
      expect(evaluate("$d get a")).to.eql(new StringValue("b"));
    });
    specify("entries", () => {
      evaluate("set d (dict (a b c d))");
      expect(evaluate("$d entries")).to.eql(evaluate("dict (a b c d) entries"));
    });
  });

  specify("get <-> keyed selector equivalence", () => {
    rootScope.setNamedVariable(
      "v",
      new MapValue({
        a: new StringValue("b"),
        c: new StringValue("d"),
      })
    );
    evaluate("set d (dict $v)");

    expect(execute("dict $v get a")).to.eql(execute("idem $v(a)"));
    expect(execute("$d get a")).to.eql(execute("idem $v(a)"));
    expect(execute("idem $[$d](a)")).to.eql(execute("idem $v(a)"));

    expect(execute("dict $v get c")).to.eql(execute("idem $v(c)"));
    expect(execute("$d get c")).to.eql(execute("idem $v(c)"));
    expect(execute("idem $[$d](c)")).to.eql(execute("idem $v(c)"));
  });
});
