import { expect } from "chai";
import { MorphemeType, Script, SyntaxChecker, Word, WordType } from "./syntax";
import { Parser } from "./parser";
import { Tokenizer } from "./tokenizer";

const LITERAL = "literal";
const TUPLE = "(word1 word2)";
const BLOCK = "{word1 word2}";
const EXPRESSION = "[word1 word2]";
const STRING = '"$some [string]"';
const HERE_STRING = '"""some here "" string"""';
const TAGGED_STRING = '""TAG\nsome tagged " string\nTAG""';
const LINE_COMMENT = "# some [{comment";
const BLOCK_COMMENT = "#{ some [block {comment }#";

const roots = [
  ["literal", LITERAL],
  ["tuple", TUPLE],
  ["block", BLOCK],
  ["expression", EXPRESSION],
];
const qualifiedSources = [
  ["literal", LITERAL],
  ["tuple", TUPLE],
  ["block", BLOCK],
];
const monomorphemes = [
  ["string", STRING],
  ["here-string", HERE_STRING],
  ["tagged string", TAGGED_STRING],
];
const ignored = [
  ["line comment", LINE_COMMENT],
  ["block comment", BLOCK_COMMENT],
];

describe("SyntaxChecker", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  let checker: SyntaxChecker;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const firstWord = (script: Script) => script.sentences[0].words[0];

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
    checker = new SyntaxChecker();
  });

  describe("roots", () => {
    for (const [type, value] of [...roots, ...monomorphemes]) {
      specify(type + " root", () => {
        const script = parse(value);
        const word = firstWord(script);
        expect(word.morphemes).to.have.length(1);
        expect(checker.checkWord(word)).to.eq(WordType.ROOT);
      });
    }
  });
  describe("compounds", () => {
    specify("literal prefix", () => {
      const script = parse(LITERAL + "$" + BLOCK);
      const word = firstWord(script);
      expect(word.morphemes).to.have.length(3);
      expect(checker.checkWord(word)).to.eq(WordType.COMPOUND);
    });
    specify("expression prefix", () => {
      const script = parse(EXPRESSION + LITERAL);
      const word = firstWord(script);
      expect(word.morphemes).to.have.length(2);
      expect(checker.checkWord(word)).to.eq(WordType.COMPOUND);
    });
    specify("substitution prefix", () => {
      const script = parse("$" + BLOCK + TUPLE + LITERAL);
      const word = firstWord(script);
      expect(word.morphemes).to.have.length(4);
      expect(checker.checkWord(word)).to.eq(WordType.COMPOUND);
    });
    specify("complex case", () => {
      const script = parse(LITERAL + "$" + BLOCK + EXPRESSION + "$" + LITERAL);
      const word = firstWord(script);
      expect(word.morphemes).to.have.length(6);
      expect(checker.checkWord(word)).to.eq(WordType.COMPOUND);
    });
    describe("exceptions", () => {
      for (const [type, value] of [
        ["tuple", TUPLE],
        ["block", BLOCK],
      ]) {
        specify(type + "/literal", () => {
          const script = parse(value + LITERAL);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eql(WordType.INVALID);
        });
        specify(type + "/substitution", () => {
          const script = parse(value + "$" + LITERAL);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(3);
          expect(checker.checkWord(word)).to.eql(WordType.INVALID);
        });
        specify("expression/" + type, () => {
          const script = parse(EXPRESSION + value);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eql(WordType.INVALID);
        });
        specify("literal/" + type + "/literal", () => {
          const script = parse(LITERAL + value + LITERAL);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(3);
          expect(checker.checkWord(word)).to.eql(WordType.INVALID);
        });
        specify("literal/" + type + "/substitution", () => {
          const script = parse(LITERAL + value + "$" + LITERAL);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(4);
          expect(checker.checkWord(word)).to.eql(WordType.INVALID);
        });
      }
    });
  });
  describe("substitutions", () => {
    for (const [type, value] of roots) {
      describe(type + " source", () => {
        specify("simple", () => {
          const script = parse("$" + value);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eq(WordType.SUBSTITUTION);
        });
        specify("double", () => {
          const script = parse("$$" + value);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eq(WordType.SUBSTITUTION);
        });
        specify("indexed selector", () => {
          const script = parse("$" + value + EXPRESSION);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(3);
          expect(checker.checkWord(word)).to.eq(WordType.SUBSTITUTION);
        });
        specify("keyed selector", () => {
          const script = parse("$" + value + TUPLE);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(3);
          expect(checker.checkWord(word)).to.eq(WordType.SUBSTITUTION);
        });
        specify("generic selector", () => {
          const script = parse("$" + value + BLOCK);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(3);
          expect(checker.checkWord(word)).to.eq(WordType.SUBSTITUTION);
        });
        specify("multiple selectors", () => {
          const script = parse(
            "$" + value + TUPLE + BLOCK + EXPRESSION + TUPLE + EXPRESSION
          );
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(7);
          expect(checker.checkWord(word)).to.eq(WordType.SUBSTITUTION);
        });
      });
    }
  });
  describe("qualified words", () => {
    for (const [type, value] of qualifiedSources) {
      describe(type + " source", () => {
        specify("indexed selector", () => {
          const script = parse(value + EXPRESSION);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eq(WordType.QUALIFIED);
        });
        specify("keyed selector", () => {
          const script = parse(value + TUPLE);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eq(WordType.QUALIFIED);
        });
        specify("generic selector", () => {
          const script = parse(value + BLOCK);
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(2);
          expect(checker.checkWord(word)).to.eq(WordType.QUALIFIED);
        });
        specify("multiple selectors", () => {
          const script = parse(
            value + TUPLE + BLOCK + EXPRESSION + TUPLE + EXPRESSION
          );
          const word = firstWord(script);
          expect(word.morphemes).to.have.length(6);
          expect(checker.checkWord(word)).to.eq(WordType.QUALIFIED);
        });
      });
    }
    describe("exceptions", () => {
      specify("trailing morphemes", () => {
        const script = parse(
          LITERAL + TUPLE + TUPLE + EXPRESSION + TUPLE + EXPRESSION + LITERAL
        );
        const word = firstWord(script);
        expect(word.morphemes).to.have.length(7);
        expect(checker.checkWord(word)).to.eql(WordType.INVALID);
      });
    });
  });
  describe("ignored words", () => {
    for (const [type, value] of ignored) {
      specify(type, () => {
        const script = parse(value);
        const word = firstWord(script);
        expect(word.morphemes).to.have.length(1);
        expect(checker.checkWord(word)).to.eq(WordType.IGNORED);
      });
    }
  });
  describe("impossible cases", () => {
    specify("empty word", () => {
      const word = new Word();
      expect(checker.checkWord(word)).to.eql(WordType.INVALID);
    });
    specify("empty substitution", () => {
      const word = new Word();
      word.morphemes.push({ type: MorphemeType.SUBSTITUTE_NEXT });
      expect(checker.checkWord(word)).to.eql(WordType.INVALID);
    });
    describe("incompatible morphemes", () => {
      for (const [type1, value1] of [...monomorphemes, ...ignored]) {
        for (const [type2, value2] of [...roots, ...monomorphemes]) {
          specify(type1 + "/" + type2, () => {
            const word = new Word();
            word.morphemes.push(firstWord(parse(value1)).morphemes[0]);
            word.morphemes.push(firstWord(parse(value2)).morphemes[0]);
            expect(checker.checkWord(word)).to.eql(WordType.INVALID);
          });
          specify(type2 + "/" + type1, () => {
            const word = new Word();
            word.morphemes.push(firstWord(parse(value2)).morphemes[0]);
            word.morphemes.push(firstWord(parse(value1)).morphemes[0]);
            expect(checker.checkWord(word)).to.eql(WordType.INVALID);
          });
        }
      }
      specify("substitution", () => {
        const word = new Word();
        word.morphemes.push({ type: MorphemeType.SUBSTITUTE_NEXT });
        word.morphemes.push({ type: MorphemeType.BLOCK_COMMENT });
        expect(checker.checkWord(word)).to.eql(WordType.INVALID);
      });
    });
  });
});
