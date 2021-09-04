import { expect } from "chai";
import { Tokenizer, TokenType } from "./tokenizer";

describe("Tokenizer", () => {
  let tokenizer: Tokenizer;
  beforeEach(() => {
    tokenizer = new Tokenizer();
  });

  specify("empty string", () => {
    expect(tokenizer.tokenize("")).to.be.empty;
  });

  specify("whitespace", () => {
    expect(tokenizer.tokenize(" ")).to.eql([TokenType.WHITESPACE]);
    expect(tokenizer.tokenize("\t")).to.eql([TokenType.WHITESPACE]);
    expect(tokenizer.tokenize("\r")).to.eql([TokenType.WHITESPACE]);
    expect(tokenizer.tokenize("\f")).to.eql([TokenType.WHITESPACE]);
    expect(tokenizer.tokenize("  ")).to.eql([TokenType.WHITESPACE]);
    expect(tokenizer.tokenize("   \t\f  \r\r ")).to.eql([TokenType.WHITESPACE]);

    expect(tokenizer.tokenize("\\ ")).to.eql([TokenType.TEXT]);
    expect(tokenizer.tokenize("\\\t")).to.eql([TokenType.TEXT]);
    expect(tokenizer.tokenize("\\\r")).to.eql([TokenType.TEXT]);
    expect(tokenizer.tokenize("\\\f")).to.eql([TokenType.TEXT]);
  });

  specify("newline", () => {
    expect(tokenizer.tokenize("\n")).to.eql([TokenType.NEWLINE]);
    expect(tokenizer.tokenize("\n\n")).to.eql([
      TokenType.NEWLINE,
      TokenType.NEWLINE,
    ]);
  });

  describe("escape sequences", () => {
    specify("backslash", () => {
      expect(tokenizer.tokenize("\\")).to.eql([TokenType.TEXT]);
    });
    specify("continuation", () => {
      expect(tokenizer.tokenize("\\\n")).to.eql([TokenType.CONTINUATION]);
      expect(tokenizer.tokenize("\\\n   ")).to.eql([TokenType.CONTINUATION]);
      expect(tokenizer.tokenize("\\\n \t\r\f ")).to.eql([
        TokenType.CONTINUATION,
      ]);
    });
    specify("control characters", () => {
      expect(tokenizer.tokenize("\\a")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\b")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\f")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\n")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\r")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\t")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\v")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\\\")).to.eql([TokenType.ESCAPE]);
    });
    specify("octal sequence", () => {
      expect(tokenizer.tokenize("\\1")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\123")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\1234")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
      expect(tokenizer.tokenize("\\0x")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
    });
    specify("hexadecimal sequence", () => {
      expect(tokenizer.tokenize("\\x1")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\x12")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\x123")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
      expect(tokenizer.tokenize("\\x1f")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\x1F")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\x1g")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
    });
    specify("unicode sequence", () => {
      expect(tokenizer.tokenize("\\u1")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\U1")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\u12")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\U12")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\u123456")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
      expect(tokenizer.tokenize("\\U12345")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\U0123456789")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
      expect(tokenizer.tokenize("\\u1f")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\u1F")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\U1f")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\U1F")).to.eql([TokenType.ESCAPE]);
      expect(tokenizer.tokenize("\\u1g")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
      expect(tokenizer.tokenize("\\U1g")).to.eql([
        TokenType.ESCAPE,
        TokenType.TEXT,
      ]);
    });
    specify("unrecognized sequences", () => {
      expect(tokenizer.tokenize("\\8")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\9")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\c")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\d")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\e")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\x")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\xg")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\u")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\ug")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\U")).to.eql([TokenType.TEXT]);
      expect(tokenizer.tokenize("\\Ug")).to.eql([TokenType.TEXT]);
    });
  });

  specify("comments", () => {
    expect(tokenizer.tokenize("#")).to.eql([TokenType.COMMENT]);
    expect(tokenizer.tokenize("###")).to.eql([TokenType.COMMENT]);

    expect(tokenizer.tokenize("\\#")).to.eql([TokenType.TEXT]);
  });

  specify("lists", () => {
    expect(tokenizer.tokenize("(")).to.eql([TokenType.OPEN_LIST]);
    expect(tokenizer.tokenize(")")).to.eql([TokenType.CLOSE_LIST]);

    expect(tokenizer.tokenize("\\(")).to.eql([TokenType.TEXT]);
    expect(tokenizer.tokenize("\\)")).to.eql([TokenType.TEXT]);
  });

  specify("blocks", () => {
    expect(tokenizer.tokenize("{")).to.eql([TokenType.OPEN_BLOCK]);
    expect(tokenizer.tokenize("}")).to.eql([TokenType.CLOSE_BLOCK]);

    expect(tokenizer.tokenize("\\{")).to.eql([TokenType.TEXT]);
    expect(tokenizer.tokenize("\\}")).to.eql([TokenType.TEXT]);
  });

  specify("commands", () => {
    expect(tokenizer.tokenize("[")).to.eql([TokenType.OPEN_COMMAND]);
    expect(tokenizer.tokenize("]")).to.eql([TokenType.CLOSE_COMMAND]);

    expect(tokenizer.tokenize("\\[")).to.eql([TokenType.TEXT]);
    expect(tokenizer.tokenize("\\]")).to.eql([TokenType.TEXT]);
  });

  specify("strings", () => {
    expect(tokenizer.tokenize('"')).to.eql([TokenType.STRING_DELIMITER]);

    expect(tokenizer.tokenize('\\"')).to.eql([TokenType.TEXT]);
  });

  specify("dollar", () => {
    expect(tokenizer.tokenize("$")).to.eql([TokenType.DOLLAR]);

    expect(tokenizer.tokenize("\\$")).to.eql([TokenType.TEXT]);
  });

  specify("semicolon", () => {
    expect(tokenizer.tokenize(";")).to.eql([TokenType.SEMICOLON]);

    expect(tokenizer.tokenize("\\;")).to.eql([TokenType.TEXT]);
  });
});
