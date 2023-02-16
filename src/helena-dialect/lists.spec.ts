import { expect } from "chai";
import { ERROR, OK, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { IntegerValue, ListValue, NIL, StringValue } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena lists", () => {
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

  describe("list", () => {
    it("should return list value", () => {
      expect(evaluate("list ()")).to.eql(new ListValue([]));
    });
    it("should convert tuples to lists", () => {
      expect(evaluate("list (a b c)")).to.eql(
        new ListValue([
          new StringValue("a"),
          new StringValue("b"),
          new StringValue("c"),
        ])
      );
    });
    it("should convert blocks to lists", () => {
      expect(evaluate("list {a b c}")).to.eql(evaluate("list (a b c)"));
    });
    describe("subcommands", () => {
      describe("length", () => {
        it("should return the list length", () => {
          expect(evaluate("list () length")).to.eql(new IntegerValue(0));
          expect(evaluate("list (a b c) length")).to.eql(new IntegerValue(3));
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("list () length a")).to.eql(
              ERROR('wrong # args: should be "list value length"')
            );
          });
        });
      });
      describe("at", () => {
        it("should return the element at the given index", () => {
          expect(evaluate("list (a b c) at 1")).to.eql(new StringValue("b"));
        });
        it("should return the default value for an out-of-range index", () => {
          expect(evaluate("list (a b c) at 10 default")).to.eql(
            new StringValue("default")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("list (a b c) at")).to.eql(
              ERROR('wrong # args: should be "list value at index ?default?"')
            );
            expect(execute("list (a b c) at a b c")).to.eql(
              ERROR('wrong # args: should be "list value at index ?default?"')
            );
          });
          specify("invalid index", () => {
            expect(execute("list (a b c) at a")).to.eql(
              ERROR('invalid integer "a"')
            );
          });
          specify("index out of range", () => {
            expect(execute("list (a b c) at -1")).to.eql(
              ERROR('index out of range "-1"')
            );
            expect(execute("list (a b c) at 10")).to.eql(
              ERROR('index out of range "10"')
            );
          });
        });
      });
      describe("range", () => {
        it("should return the list included within [first, last]", () => {
          expect(evaluate("list (a b c d e f) range 1 3")).to.eql(
            evaluate("list (b c d)")
          );
        });
        it("should return the remainder of the list when given first only", () => {
          expect(evaluate("list (a b c) range 2")).to.eql(evaluate("list (c)"));
        });
        it("should truncate out of range boundaries", () => {
          expect(evaluate("list (a b c) range -1")).to.eql(
            evaluate("list (a b c)")
          );
          expect(evaluate("list (a b c) range -10 1")).to.eql(
            evaluate("list (a b)")
          );
          expect(evaluate("list (a b c) range 2 10")).to.eql(
            evaluate("list (c)")
          );
          expect(evaluate("list (a b c) range -2 10")).to.eql(
            evaluate("list (a b c)")
          );
        });
        it("should return an empty list when last is before first", () => {
          expect(evaluate("list (a b c) range 2 0")).to.eql(new ListValue([]));
        });
        it("should return an empty list when first is past the list length", () => {
          expect(evaluate("list (a b c) range 10 12")).to.eql(
            evaluate("list ()")
          );
        });
        it("should return an empty list when last is negative", () => {
          expect(evaluate("list (a b c) range -3 -1")).to.eql(
            evaluate("list ()")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("list (a b c) range")).to.eql(
              ERROR('wrong # args: should be "list value range first ?last?"')
            );
            expect(execute("list (a b c) range a b c")).to.eql(
              ERROR('wrong # args: should be "list value range first ?last?"')
            );
          });
          specify("invalid index", () => {
            expect(execute("list (a b c) range a")).to.eql(
              ERROR('invalid integer "a"')
            );
            expect(execute("list (a b c) range 1 b")).to.eql(
              ERROR('invalid integer "b"')
            );
          });
        });
      });
      describe("remove", () => {
        it("should remove the range included within [first, last]", () => {
          expect(evaluate("list (a b c d e f) remove 1 3")).to.eql(
            evaluate("list (a e f)")
          );
        });
        it("should truncate out of range boundaries", () => {
          expect(evaluate("list (a b c) remove -10 1")).to.eql(
            evaluate("list (c)")
          );
          expect(evaluate("list (a b c) remove 2 10")).to.eql(
            evaluate("list (a b)")
          );
          expect(evaluate("list (a b c) remove -2 10")).to.eql(
            evaluate("list ()")
          );
        });
        it("should do nothing when last is before first", () => {
          expect(evaluate("list (a b c) remove 2 0")).to.eql(
            evaluate("list (a b c)")
          );
        });
        it("should do nothing when last is negative", () => {
          expect(evaluate("list (a b c) remove -3 -1")).to.eql(
            evaluate("list (a b c)")
          );
        });
        it("should do nothing when first is past the list length", () => {
          expect(evaluate("list (a b c) remove 10 12")).to.eql(
            evaluate("list (a b c)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("list (a b c) remove a")).to.eql(
              ERROR('wrong # args: should be "list value remove first last"')
            );
            expect(execute("list (a b c) remove a b c d")).to.eql(
              ERROR('wrong # args: should be "list value remove first last"')
            );
          });
          specify("invalid index", () => {
            expect(execute("list (a b c) remove a b")).to.eql(
              ERROR('invalid integer "a"')
            );
            expect(execute("list (a b c) remove 1 b")).to.eql(
              ERROR('invalid integer "b"')
            );
          });
        });
      });
      describe("composition", () => {
        describe("append", () => {
          it("should append two lists", () => {
            expect(evaluate("list (a b c) append (foo bar)")).to.eql(
              evaluate("list (a b c foo bar)")
            );
          });
          it("should accept several lists", () => {
            expect(
              evaluate("list (a b c) append (foo bar) (baz) (sprong yada)")
            ).to.eql(evaluate("list (a b c foo bar baz sprong yada)"));
          });
          it("should accept zero list", () => {
            expect(evaluate("list (a b c) append")).to.eql(
              evaluate("list (a b c)")
            );
          });
          describe("exceptions", () => {
            specify("invalid values", () => {
              expect(execute("list (a b c) append []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) append [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) append a")).to.eql(
                ERROR("invalid list")
              );
            });
          });
        });
        describe("insert", () => {
          it("should insert the list at the given index", () => {
            expect(evaluate("list (a b c) insert 1 (foo bar)")).to.eql(
              evaluate("list (a foo bar b c)")
            );
          });
          it("should prepend the list when index is negative", () => {
            expect(evaluate("list (a b c) insert -10 (foo bar)")).to.eql(
              evaluate("list (foo bar a b c)")
            );
          });
          it("should append the list when index is past the list length", () => {
            expect(evaluate("list (a b c) insert 10 (foo bar)")).to.eql(
              evaluate("list (a b c foo bar)")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("list (a b c) insert a")).to.eql(
                ERROR('wrong # args: should be "list value insert index new"')
              );
              expect(execute("list (a b c) insert a b c")).to.eql(
                ERROR('wrong # args: should be "list value insert index new"')
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) insert a b")).to.eql(
                ERROR('invalid integer "a"')
              );
            });
            specify("invalid values", () => {
              expect(execute("list (a b c) insert 1 []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) append [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) insert 1 a")).to.eql(
                ERROR("invalid list")
              );
            });
          });
        });
        describe("replace", () => {
          it("should replace the range included within [first, last] with the given list", () => {
            expect(evaluate("list (a b c d e) replace 1 3 (foo bar)")).to.eql(
              evaluate("list (a foo bar e)")
            );
          });
          it("should truncate out of range boundaries", () => {
            expect(evaluate("list (a b c) replace -10 1 (foo bar)")).to.eql(
              evaluate("list (foo bar c)")
            );
            expect(evaluate("list (a b c) replace 2 10 (foo bar)")).to.eql(
              evaluate("list (a b foo bar)")
            );
            expect(evaluate("list (a b c) replace -2 10 (foo bar)")).to.eql(
              evaluate("list (foo bar)")
            );
          });
          it("should insert the list at first index when last is before first", () => {
            expect(evaluate("list (a b c) replace 2 0 (foo bar)")).to.eql(
              evaluate("list (a b foo bar c)")
            );
          });
          it("should prepend the list when last is negative", () => {
            expect(evaluate("list (a b c) replace -3 -1 (foo bar)")).to.eql(
              evaluate("list (foo bar a b c)")
            );
          });
          it("should append the list when first is past the list length", () => {
            expect(evaluate("list (a b c) replace 10 12 (foo bar)")).to.eql(
              evaluate("list (a b c foo bar)")
            );
          });
          describe("exceptions", () => {
            specify("wrong arity", () => {
              expect(execute("list (a b c) replace a b")).to.eql(
                ERROR(
                  'wrong # args: should be "list value replace first last new"'
                )
              );
              expect(execute("list (a b c) replace a b c d")).to.eql(
                ERROR(
                  'wrong # args: should be "list value replace first last new"'
                )
              );
            });
            specify("invalid index", () => {
              expect(execute("list (a b c) replace a b c")).to.eql(
                ERROR('invalid integer "a"')
              );
              expect(execute("list (a b c) replace 1 b c")).to.eql(
                ERROR('invalid integer "b"')
              );
            });
            specify("invalid values", () => {
              expect(execute("list (a b c) replace 1 1 []")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) replace 1 1 [1]")).to.eql(
                ERROR("invalid list")
              );
              expect(execute("list (a b c) replace 1 1 a")).to.eql(
                ERROR("invalid list")
              );
            });
          });
        });
      });
      describe("foreach", () => {
        it("should iterate over elements", () => {
          evaluate(`
            set elements [list ()]
            set l [list (a b c)]
            list $l foreach element {
              set elements [list $elements append ($element)]
            }
            `);
          expect(evaluate("get elements")).to.eql(evaluate("get l"));
        });
        it("should return the result of the last command", () => {
          expect(execute("list () foreach element {}")).to.eql(OK(NIL));
          expect(execute("list (a b c) foreach element {}")).to.eql(OK(NIL));
          expect(
            evaluate("set i 0; list (a b c) foreach element {set i [+ $i 1]}")
          ).to.eql(new IntegerValue(3));
        });
        describe("control flow", () => {
          describe("return", () => {
            it("should interrupt the loop with RETURN code", () => {
              expect(
                execute(
                  "set i 0; list (a b c) foreach element {set i [+ $i 1]; return $element; unreachable}"
                )
              ).to.eql(execute("return a"));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("tailcall", () => {
            it("should interrupt the loop with RETURN code", () => {
              expect(
                execute(
                  "set i 0; list (a b c) foreach element {set i [+ $i 1]; tailcall {idem $element}; unreachable}"
                )
              ).to.eql(execute("return a"));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("yield", () => {
            it("should interrupt the body with YIELD code", () => {
              expect(
                execute("list (a b c) foreach element {yield; unreachable}")
                  .code
              ).to.eql(ResultCode.YIELD);
            });
            it("should provide a resumable state", () => {
              const process = rootScope.prepareScript(
                parse("list (a b c) foreach element {idem _$[yield $element]_}")
              );

              let result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("a"));
              expect(result.data).to.exist;

              process.yieldBack(new StringValue("step 1"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("b"));
              expect(result.data).to.exist;

              process.yieldBack(new StringValue("step 2"));
              result = process.run();
              expect(result.code).to.eql(ResultCode.YIELD);
              expect(result.value).to.eql(new StringValue("c"));
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
                  "set i 0; list (a b c) foreach element {set i [+ $i 1]; error msg; unreachable}"
                )
              ).to.eql(ERROR("msg"));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("break", () => {
            it("should interrupt the body with nil result", () => {
              expect(
                execute(
                  "set i 0; list (a b c) foreach element {set i [+ $i 1]; break; unreachable}"
                )
              ).to.eql(OK(NIL));
              expect(evaluate("get i")).to.eql(new IntegerValue(1));
            });
          });
          describe("continue", () => {
            it("should interrupt the body iteration", () => {
              expect(
                execute(
                  "set i 0; list (a b c) foreach element {set i [+ $i 1]; continue; unreachable}"
                )
              ).to.eql(OK(NIL));
              expect(evaluate("get i")).to.eql(new IntegerValue(3));
            });
          });
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("list (a b c) foreach a")).to.eql(
              ERROR('wrong # args: should be "list value foreach element body"')
            );
            expect(execute("list (a b c) foreach a b c")).to.eql(
              ERROR('wrong # args: should be "list value foreach element body"')
            );
          });
          specify("non-script body", () => {
            expect(execute("list (a b c) foreach a b")).to.eql(
              ERROR("body must be a script")
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("non-existing subcommand", () => {
          expect(execute("list () unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("list () []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
      it("should be extensible", () => {
        evaluate(
          `[list] eval {
            macro last {value} {
              list $value at [- [list $value length] 1]
            }
          }`
        );
        expect(evaluate("list (a b c) last")).to.eql(new StringValue("c"));
      });
    });
    describe("exceptions", () => {
      specify("invalid values", () => {
        expect(execute("list []")).to.eql(ERROR("invalid list"));
        expect(execute("list [1]")).to.eql(ERROR("invalid list"));
        expect(execute("list a")).to.eql(ERROR("invalid list"));
      });
      specify("blocks with side effects", () => {
        expect(execute("list { $a }")).to.eql(ERROR("invalid list"));
        expect(execute("list { [b] }")).to.eql(ERROR("invalid list"));
        expect(execute("list { $[][a] }")).to.eql(ERROR("invalid list"));
        expect(execute("list { $[](a) }")).to.eql(ERROR("invalid list"));
      });
    });
  });

  describe("currying", () => {
    specify("identity", () => {
      evaluate("set l (list (a b c))");
      expect(evaluate("$l")).to.eql(evaluate("list (a b c)"));
    });
    specify("length", () => {
      evaluate("set l (list (a b c))");
      expect(evaluate("$l length")).to.eql(new IntegerValue(3));
    });
    specify("at", () => {
      evaluate("set l (list (a b c))");
      expect(evaluate("$l at 2")).to.eql(new StringValue("c"));
    });
    specify("range", () => {
      evaluate("set l (list (a b c d e f g))");
      expect(evaluate("$l range 3 5")).to.eql(evaluate("list (d e f)"));
    });
  });

  specify("at <-> indexed selector equivalence", () => {
    rootScope.setNamedVariable(
      "v",
      new ListValue([
        new StringValue("a"),
        new StringValue("b"),
        new StringValue("c"),
      ])
    );
    evaluate("set l (list $v)");

    expect(execute("list $v at 2")).to.eql(execute("idem $v[2]"));
    expect(execute("$l at 2")).to.eql(execute("idem $v[2]"));
    expect(execute("idem $[$l][2]")).to.eql(execute("idem $v[2]"));

    expect(execute("list $l at -1")).to.eql(execute("idem $v[-1]"));
    expect(execute("$l at -1")).to.eql(execute("idem $v[-1]"));
    expect(execute("idem $[$l][-1]")).to.eql(execute("idem $v[-1]"));
  });
});
