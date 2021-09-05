import { expect } from "chai";
import { Token, Tokenizer, TokenType } from "./tokenizer";

const toType = (token: Token) => token.type;
const toIndex = (token: Token) => token.position.index;
const toLine = (token: Token) => token.position.line;
const toColumn = (token: Token) => token.position.column;
const toLength = (token: Token) => token.length;

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

      expect(tokenizer.tokenize("\\ ").map(toType)).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\\t").map(toType)).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\\r").map(toType)).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\\f").map(toType)).to.eql([TokenType.TEXT]);
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
        expect(tokenizer.tokenize("\\8").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\9").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\c").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\d").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\e").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\x").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\xg").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\u").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\ug").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\U").map(toType)).to.eql([TokenType.TEXT]);
        expect(tokenizer.tokenize("\\Ug").map(toType)).to.eql([TokenType.TEXT]);
      });
    });

    specify("comments", () => {
      expect(tokenizer.tokenize("#").map(toType)).to.eql([TokenType.COMMENT]);
      expect(tokenizer.tokenize("###").map(toType)).to.eql([TokenType.COMMENT]);

      expect(tokenizer.tokenize("\\#").map(toType)).to.eql([TokenType.TEXT]);
    });

    specify("lists", () => {
      expect(tokenizer.tokenize("(").map(toType)).to.eql([TokenType.OPEN_LIST]);
      expect(tokenizer.tokenize(")").map(toType)).to.eql([
        TokenType.CLOSE_LIST,
      ]);

      expect(tokenizer.tokenize("\\(").map(toType)).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\)").map(toType)).to.eql([TokenType.TEXT]);
    });

    specify("blocks", () => {
      expect(tokenizer.tokenize("{").map(toType)).to.eql([
        TokenType.OPEN_BLOCK,
      ]);
      expect(tokenizer.tokenize("}").map(toType)).to.eql([
        TokenType.CLOSE_BLOCK,
      ]);

      expect(tokenizer.tokenize("\\{").map(toType)).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\}").map(toType)).to.eql([TokenType.TEXT]);
    });

    specify("commands", () => {
      expect(tokenizer.tokenize("[").map(toType)).to.eql([
        TokenType.OPEN_COMMAND,
      ]);
      expect(tokenizer.tokenize("]").map(toType)).to.eql([
        TokenType.CLOSE_COMMAND,
      ]);

      expect(tokenizer.tokenize("\\[").map(toType)).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\]").map(toType)).to.eql([TokenType.TEXT]);
    });

    specify("strings", () => {
      expect(tokenizer.tokenize('"').map(toType)).to.eql([
        TokenType.STRING_DELIMITER,
      ]);

      expect(tokenizer.tokenize('\\"').map(toType)).to.eql([TokenType.TEXT]);
    });

    specify("dollar", () => {
      expect(tokenizer.tokenize("$").map(toType)).to.eql([TokenType.DOLLAR]);

      expect(tokenizer.tokenize("\\$").map(toType)).to.eql([TokenType.TEXT]);
    });

    specify("semicolon", () => {
      expect(tokenizer.tokenize(";").map(toType)).to.eql([TokenType.SEMICOLON]);

      expect(tokenizer.tokenize("\\;").map(toType)).to.eql([TokenType.TEXT]);
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
    it("should track length", () => {
      expect(tokenizer.tokenize("a b c").map(toLength)).to.eql([1, 1, 1, 1, 1]);
      expect(tokenizer.tokenize("abc \r\f de\tf").map(toLength)).to.eql([
        3, 4, 2, 1, 1,
      ]);
      expect(tokenizer.tokenize("# ## ### ").map(toLength)).to.eql([
        1, 1, 2, 1, 3, 1,
      ]);
    });
  });
});
