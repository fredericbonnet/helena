import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import {
  IntegerValue,
  ListValue,
  ScriptValue,
  StringValue,
  TupleValue,
} from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena scripts", () => {
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

  describe("parse", () => {
    it("should return a script value", () => {
      expect(evaluate('parse ""')).to.be.instanceOf(ScriptValue);
    });
    it("should return parsed script and source", () => {
      const source = "cmd arg1 arg2";
      const script = parse(source);
      expect(evaluate(`parse "${source}"`)).to.eql(
        new ScriptValue(script, source)
      );
    });
    it("should parse blocks as string values", () => {
      evaluate("set script {cmd arg1 arg2}");
      expect(evaluate(`parse $script`)).to.eql(evaluate("get script"));
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("parse")).to.eql(
          ERROR('wrong # args: should be "parse source"')
        );
        expect(execute("parse a b")).to.eql(
          ERROR('wrong # args: should be "parse source"')
        );
      });
      specify("parsing error", () => {
        expect(execute('parse "{"')).to.eql(ERROR("unmatched left brace"));
        expect(execute('parse ")"')).to.eql(
          ERROR("unmatched right parenthesis")
        );
        expect(execute('parse "#{"')).to.eql(
          ERROR("unmatched block comment delimiter")
        );
      });
      specify("invalid values", () => {
        expect(execute("parse []")).to.eql(
          ERROR("value has no string representation")
        );
        expect(execute("parse ()")).to.eql(
          ERROR("value has no string representation")
        );
      });
    });
  });

  describe("script", () => {
    it("should return script value", () => {
      expect(evaluate("script {}")).to.be.instanceOf(ScriptValue);
    });
    it("should accept blocks", () => {
      expect(evaluate("script {}")).to.eql(new ScriptValue(parse(""), ""));
      expect(evaluate("script {a b c; d e}")).to.eql(
        new ScriptValue(parse("a b c; d e"), "a b c; d e")
      );
    });
    describe("tuples", () => {
      it("should be converted to scripts", () => {
        expect(evaluate("script ()")).to.be.instanceOf(ScriptValue);
      });
      specify("string value should be undefined", () => {
        expect((evaluate("script ()") as ScriptValue).source).to.be.undefined;
        expect((evaluate("script (a b)") as ScriptValue).source).to.be
          .undefined;
      });
      specify("empty tuples should return empty scripts", () => {
        const script = evaluate("script ()") as ScriptValue;
        expect(script.script.sentences).to.be.empty;
      });
      it("non-empty tuples should return single-sentence scripts", () => {
        const script = evaluate(
          "script (cmd (a) ; ; #{comment}# [1])"
        ) as ScriptValue;
        expect(script.script.sentences).to.have.lengthOf(1);
        expect(script.script.sentences[0].words).to.eql([
          new StringValue("cmd"),
          new TupleValue([new StringValue("a")]),
          new IntegerValue(1),
        ]);
      });
    });
    describe("subcommands", () => {
      describe("subcommands", () => {
        it("should return list of subcommands", () => {
          expect(evaluate("script {} subcommands")).to.eql(
            evaluate("list (subcommands length append split)")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("script {} subcommands a")).to.eql(
              ERROR('wrong # args: should be "script value subcommands"')
            );
          });
        });
      });
      describe("length", () => {
        it("should return the number of sentences", () => {
          expect(evaluate("script {} length")).to.eql(new IntegerValue(0));
          expect(evaluate("script {a b; c d;; ;} length")).to.eql(
            new IntegerValue(2)
          );
          expect(evaluate("script () length")).to.eql(new IntegerValue(0));
          expect(evaluate("script (a b; c d;; ;) length")).to.eql(
            new IntegerValue(1)
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("script () length a")).to.eql(
              ERROR('wrong # args: should be "script value length"')
            );
          });
        });
      });
      describe("append", () => {
        it("should append two scripts", () => {
          expect(evaluate("script {a b c} append {foo bar}")).to.eql(
            new ScriptValue(parse("a b c; foo bar"), undefined)
          );
        });
        it("should accept several scripts", () => {
          expect(
            evaluate("script {a b; c ; d e} append {f g} {h i; j k l} {m n; o}")
          ).to.eql(
            new ScriptValue(
              parse("a b; c; d e; f g; h i; j k l; m n; o"),
              undefined
            )
          );
        });
        it("should accept both scripts and tuples scripts", () => {
          expect(
            (
              evaluate(
                "script {a b; c ; d e} append (f g) {h i; j k l} (m n; o)"
              ) as ScriptValue
            ).script.sentences
          ).to.have.lengthOf(7);
        });
        it("should accept zero scripts", () => {
          expect(evaluate("script {a b c} append")).to.eql(
            evaluate("script {a b c}")
          );
        });
        describe("exceptions", () => {
          specify("invalid values", () => {
            expect(execute("script {} append []")).to.eql(
              ERROR("value must be a script or tuple")
            );
            expect(execute("script {} append a")).to.eql(
              ERROR("value must be a script or tuple")
            );
            expect(execute("script {} append a [1]")).to.eql(
              ERROR("value must be a script or tuple")
            );
          });
        });
      });
      describe("split", () => {
        it("should split script sentences into list of scripts", () => {
          expect(evaluate("script {} split")).to.eql(evaluate("list {}"));
          expect(evaluate("script {a b; c d;; ;} split")).to.eql(
            new ListValue([
              new ScriptValue(parse("a b"), undefined),
              new ScriptValue(parse("c d"), undefined),
            ])
          );
          expect(evaluate("script () split")).to.eql(new ListValue([]));
          expect(evaluate("script (a b; c d;; ;) split")).to.eql(
            evaluate("list ([script (a b c d)])")
          );
        });
        describe("exceptions", () => {
          specify("wrong arity", () => {
            expect(execute("script () split a")).to.eql(
              ERROR('wrong # args: should be "script value split"')
            );
          });
        });
      });
      describe("exceptions", () => {
        specify("unknown subcommand", () => {
          expect(execute("script {} unknownSubcommand")).to.eql(
            ERROR('unknown subcommand "unknownSubcommand"')
          );
        });
        specify("invalid subcommand name", () => {
          expect(execute("script {} []")).to.eql(
            ERROR("invalid subcommand name")
          );
        });
      });
      it("should be extensible", () => {
        evaluate(
          `[script] eval {
            macro last {value} {
              list [script $value split] at [- [script $value length] 1]
            }
          }`
        );
        expect(evaluate("script {cmd1 a b; cmd2 c d; cmd3 e f} last")).to.eql(
          new ScriptValue(parse("cmd3 e f"), undefined)
        );
      });
    });
  });
});
