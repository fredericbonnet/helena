import { expect } from "chai";
import { Token, Tokenizer, TokenType } from "./tokenizer";

const toType = (token: Token) => token.type;
const toIndex = (token: Token) => token.position.index;
const toLine = (token: Token) => token.position.line;
const toColumn = (token: Token) => token.position.column;
const toLiteral = (token: Token) => token.literal;
const toSequence = (token: Token) => token.sequence;

describe("Tokenizer", () => {
  let tokenizer: Tokenizer;
  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  specify("empty string", () => {
    expect(tokenizer.tokenize("")).to.be.empty;
  });

  describe("types", () => {
    specify("whitespace", () => {
      expect(tokenizer.tokenize(" ").map(toType)).to.eql([
        TokenType.WHITESPACE,
      ]);
      expect(tokenizer.tokenize("\t").map(toType)).to.eql([
        TokenType.WHITESPACE,
      ]);
      expect(tokenizer.tokenize("\r").map(toType)).to.eql([
        TokenType.WHITESPACE,
      ]);
      expect(tokenizer.tokenize("\f").map(toType)).to.eql([
        TokenType.WHITESPACE,
      ]);
      expect(tokenizer.tokenize("  ").map(toType)).to.eql([
        TokenType.WHITESPACE,
      ]);
      expect(tokenizer.tokenize("   \t\f  \r\r ").map(toType)).to.eql([
        TokenType.WHITESPACE,
      ]);

      expect(tokenizer.tokenize("\\ ").map(toType)).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\\t").map(toType)).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\\r").map(toType)).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\\f").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("newline", () => {
      expect(tokenizer.tokenize("\n").map(toType)).to.eql([TokenType.NEWLINE]);
      expect(tokenizer.tokenize("\n\n").map(toType)).to.eql([
        TokenType.NEWLINE,
        TokenType.NEWLINE,
      ]);
    });

    describe("escape sequences", () => {
      specify("backslash", () => {
        expect(tokenizer.tokenize("\\").map(toType)).to.eql([TokenType.TEXT]);
      });
      specify("continuation", () => {
        expect(tokenizer.tokenize("\\\n").map(toType)).to.eql([
          TokenType.CONTINUATION,
        ]);
        expect(tokenizer.tokenize("\\\n   ").map(toType)).to.eql([
          TokenType.CONTINUATION,
        ]);
        expect(tokenizer.tokenize("\\\n \t\r\f ").map(toType)).to.eql([
          TokenType.CONTINUATION,
        ]);
        expect(tokenizer.tokenize("\\\n \t \\\n  ").map(toType)).to.eql([
          TokenType.CONTINUATION,
          TokenType.CONTINUATION,
        ]);
      });
      specify("control characters", () => {
        expect(tokenizer.tokenize("\\a").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\b").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\f").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\n").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\r").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\t").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\v").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\\\").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
      });
      specify("octal sequence", () => {
        expect(tokenizer.tokenize("\\1").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\123").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\1234").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\0x").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
      });
      specify("hexadecimal sequence", () => {
        expect(tokenizer.tokenize("\\x1").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\x12").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\x123").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\x1f").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\x1F").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\x1g").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
      });
      specify("unicode sequence", () => {
        expect(tokenizer.tokenize("\\u1").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\U1").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\u12").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\U12").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\u123456").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\U12345").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\U0123456789").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\u1f").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\u1F").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\U1f").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\U1F").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\u1g").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\U1g").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
      });
      specify("unrecognized sequences", () => {
        expect(tokenizer.tokenize("\\8").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\9").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\c").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\d").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\e").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\x").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\xg").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\u").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\ug").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
        expect(tokenizer.tokenize("\\U").map(toType)).to.eql([
          TokenType.ESCAPE,
        ]);
        expect(tokenizer.tokenize("\\Ug").map(toType)).to.eql([
          TokenType.ESCAPE,
          TokenType.TEXT,
        ]);
      });
    });

    specify("comments", () => {
      expect(tokenizer.tokenize("#").map(toType)).to.eql([TokenType.COMMENT]);
      expect(tokenizer.tokenize("###").map(toType)).to.eql([TokenType.COMMENT]);

      expect(tokenizer.tokenize("\\#").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("tuples", () => {
      expect(tokenizer.tokenize("(").map(toType)).to.eql([
        TokenType.OPEN_TUPLE,
      ]);
      expect(tokenizer.tokenize(")").map(toType)).to.eql([
        TokenType.CLOSE_TUPLE,
      ]);

      expect(tokenizer.tokenize("\\(").map(toType)).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\)").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("blocks", () => {
      expect(tokenizer.tokenize("{").map(toType)).to.eql([
        TokenType.OPEN_BLOCK,
      ]);
      expect(tokenizer.tokenize("}").map(toType)).to.eql([
        TokenType.CLOSE_BLOCK,
      ]);

      expect(tokenizer.tokenize("\\{").map(toType)).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\}").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("expressions", () => {
      expect(tokenizer.tokenize("[").map(toType)).to.eql([
        TokenType.OPEN_EXPRESSION,
      ]);
      expect(tokenizer.tokenize("]").map(toType)).to.eql([
        TokenType.CLOSE_EXPRESSION,
      ]);

      expect(tokenizer.tokenize("\\[").map(toType)).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\]").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("strings", () => {
      expect(tokenizer.tokenize('"').map(toType)).to.eql([
        TokenType.STRING_DELIMITER,
      ]);

      expect(tokenizer.tokenize('\\"').map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("dollar", () => {
      expect(tokenizer.tokenize("$").map(toType)).to.eql([TokenType.DOLLAR]);

      expect(tokenizer.tokenize("\\$").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("semicolon", () => {
      expect(tokenizer.tokenize(";").map(toType)).to.eql([TokenType.SEMICOLON]);

      expect(tokenizer.tokenize("\\;").map(toType)).to.eql([TokenType.ESCAPE]);
    });

    specify("asterisk", () => {
      expect(tokenizer.tokenize("*").map(toType)).to.eql([TokenType.ASTERISK]);

      expect(tokenizer.tokenize("\\*").map(toType)).to.eql([TokenType.ESCAPE]);
    });
  });

  describe("positions", () => {
    it("should track index", () => {
      expect(tokenizer.tokenize("a b c").map(toIndex)).to.eql([0, 1, 2, 3, 4]);
      expect(tokenizer.tokenize("abc \r\f de\tf").map(toIndex)).to.eql([
        0, 3, 7, 9, 10,
      ]);
    });
    it("should track line", () => {
      expect(tokenizer.tokenize("a b c").map(toLine)).to.eql([0, 0, 0, 0, 0]);
      expect(tokenizer.tokenize("a\nbcd e\nfg  h").map(toLine)).to.eql([
        0, 0, 1, 1, 1, 1, 2, 2, 2,
      ]);
    });
    it("should track column", () => {
      expect(tokenizer.tokenize("a b c").map(toColumn)).to.eql([0, 1, 2, 3, 4]);
      expect(tokenizer.tokenize("a\nbcd e\nfg  h").map(toColumn)).to.eql([
        0, 1, 0, 3, 4, 5, 0, 2, 4,
      ]);
    });
  });

  describe("literals", () => {
    specify("text", () => {
      expect(tokenizer.tokenize("abcd").map(toLiteral)).to.eql(["abcd"]);
    });
    specify("escape", () => {
      expect(
        tokenizer.tokenize("\\a\\b\\f\\n\\r\\t\\v\\\\").map(toLiteral)
      ).to.eql(["\x07", "\b", "\f", "\n", "\r", "\t", "\v", "\\"]);
      expect(tokenizer.tokenize("\\123").map(toLiteral)).to.eql(["S"]);
      expect(tokenizer.tokenize("\\xA5").map(toLiteral)).to.eql(["¥"]);
      expect(tokenizer.tokenize("\\u1234").map(toLiteral)).to.eql(["\u1234"]);
      expect(
        tokenizer.tokenize("\\U00012345\\U0006789A").map(toLiteral)
      ).to.eql([String.fromCharCode(0x12345), String.fromCharCode(0x6789a)]);
      expect(
        tokenizer
          .tokenize("\\8\\9\\c\\d\\e\\x\\xg\\u\\ug\\U\\Ug")
          .map(toLiteral)
      ).to.eql([
        "8",
        "9",
        "c",
        "d",
        "e",
        "x",
        "x",
        "g",
        "u",
        "u",
        "g",
        "U",
        "U",
        "g",
      ]);
    });
    specify("continuation", () => {
      expect(tokenizer.tokenize("\\\n").map(toLiteral)).to.eql([" "]);
      expect(tokenizer.tokenize("\\\n   ").map(toLiteral)).to.eql([" "]);
      expect(tokenizer.tokenize("\\\n \t\r\f ").map(toLiteral)).to.eql([" "]);
      expect(tokenizer.tokenize("\\\n \t \\\n  ").map(toLiteral)).to.eql([
        " ",
        " ",
      ]);
    });
  });
  describe("sequences", () => {
    specify("text", () => {
      expect(tokenizer.tokenize("abcd").map(toSequence)).to.eql(["abcd"]);
    });
    specify("escape", () => {
      expect(
        tokenizer.tokenize("\\a\\b\\f\\n\\r\\t\\v\\\\").map(toSequence)
      ).to.eql(["\\a", "\\b", "\\f", "\\n", "\\r", "\\t", "\\v", "\\\\"]);
      expect(tokenizer.tokenize("\\123").map(toSequence)).to.eql(["\\123"]);
      expect(tokenizer.tokenize("\\xA5").map(toSequence)).to.eql(["\\xA5"]);
      expect(tokenizer.tokenize("\\u1234").map(toSequence)).to.eql(["\\u1234"]);
      expect(
        tokenizer.tokenize("\\U00012345\\U0006789A").map(toSequence)
      ).to.eql(["\\U00012345", "\\U0006789A"]);
    });
    specify("continuation", () => {
      expect(tokenizer.tokenize("\\\n").map(toSequence)).to.eql(["\\\n"]);
      expect(tokenizer.tokenize("\\\n   ").map(toSequence)).to.eql(["\\\n   "]);
      expect(tokenizer.tokenize("\\\n \t\r\f ").map(toSequence)).to.eql([
        "\\\n \t\r\f ",
      ]);
      expect(tokenizer.tokenize("\\\n \t \\\n  ").map(toSequence)).to.eql([
        "\\\n \t ",
        "\\\n  ",
      ]);
    });
  });
});
