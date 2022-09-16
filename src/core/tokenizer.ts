/**
 * @file Helena tokenization
 */

/**
 * Helena token type for each special character or sequence
 */
export enum TokenType {
  WHITESPACE,
  NEWLINE,
  CONTINUATION,
  TEXT,
  ESCAPE,
  COMMENT,
  OPEN_TUPLE,
  CLOSE_TUPLE,
  OPEN_BLOCK,
  CLOSE_BLOCK,
  OPEN_EXPRESSION,
  CLOSE_EXPRESSION,
  STRING_DELIMITER,
  DOLLAR,
  SEMICOLON,
  ASTERISK,
}

/**
 * Position in character stream
 */
export class Position {
  /** Character index (zero-indexed) */
  index = 0;

  /** Line number (zero-indexed) */
  line = 0;

  /** Column number (zero-indexed) */
  column = 0;

  /**
   * Make a copy of the current position
   *
   * @returns a new position
   */
  copy() {
    const copy = new Position();
    copy.index = this.index;
    copy.line = this.line;
    copy.column = this.column;
    return copy;
  }

  /**
   * Advance to next character
   *
   * @param newline - Whether to increment line number
   *
   * @returns         Previous index
   */
  next(newline: boolean) {
    if (newline) {
      this.line++;
      this.column = 0;
    } else {
      this.column++;
    }
    return this.index++;
  }
}

/**
 * Helena token
 */
export interface Token {
  /** Token type */
  type: TokenType;

  /** Position in source stream */
  position: Position;

  /** Raw sequence of characters from stream */
  sequence: string;

  /** String literal */
  literal: string;
}

/**
 * Helena tokenizer
 *
 * This class transforms a stream of characters into a stream of tokens
 */
export class Tokenizer {
  /** Input stream */
  private stream: StringStream;

  /** Output tokens */
  private tokens: Token[];

  /**
   * Tokenize a Helena source string
   *
   * @param source - Source string
   *
   * @returns        Array of tokens
   */
  tokenize(source: string): Token[] {
    this.stream = new StringStream(source);
    this.tokens = [];

    while (!this.stream.end()) {
      const position = this.stream.position.copy();
      const c = this.stream.next();
      switch (c) {
        // Whitespaces
        case " ":
        case "\t":
        case "\r":
        case "\f":
          while (
            !this.stream.end() &&
            this.isWhitespace(this.stream.current())
          ) {
            this.stream.next();
          }
          this.addToken(TokenType.WHITESPACE, position);
          break;

        // Newline
        case "\n":
          this.addToken(TokenType.NEWLINE, position);
          break;

        // Escape sequence
        case "\\": {
          if (this.stream.end()) {
            this.addToken(TokenType.TEXT, position);
            break;
          }
          const e = this.stream.next();
          if (e == "\n") {
            // Continuation, eat up all subsequent whitespaces
            while (
              !this.stream.end() &&
              this.isWhitespace(this.stream.current())
            ) {
              this.stream.next();
            }
            this.addToken(TokenType.CONTINUATION, position, " ");
            break;
          }
          let escape = e; // Default value for unrecognized sequences
          if (this.isEscape(e)) {
            escape = this.getEscape(e);
          } else if (this.isOctal(e)) {
            let codepoint = Number.parseInt(e);
            let i = 1;
            while (
              !this.stream.end() &&
              this.isOctal(this.stream.current()) &&
              i < 3
            ) {
              codepoint *= 8;
              codepoint += Number.parseInt(this.stream.current());
              this.stream.next();
              i++;
            }
            escape = String.fromCharCode(codepoint);
          } else if (e == "x") {
            let codepoint = 0;
            let i = 0;
            while (
              !this.stream.end() &&
              this.isHexadecimal(this.stream.current()) &&
              i < 2
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + this.stream.current());
              this.stream.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          } else if (e == "u") {
            let codepoint = 0;
            let i = 0;
            while (
              !this.stream.end() &&
              this.isHexadecimal(this.stream.current()) &&
              i < 4
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + this.stream.current());
              this.stream.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          } else if (e == "U") {
            let codepoint = 0;
            let i = 0;
            while (
              !this.stream.end() &&
              this.isHexadecimal(this.stream.current()) &&
              i < 8
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + this.stream.current());
              this.stream.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          }
          this.addToken(TokenType.ESCAPE, position, escape);
          break;
        }

        // Comment
        case "#":
          while (!this.stream.end() && this.stream.current() == "#") {
            this.stream.next();
          }
          this.addToken(TokenType.COMMENT, position);
          break;

        // Tuple delimiters
        case "(":
          this.addToken(TokenType.OPEN_TUPLE, position);
          break;
        case ")":
          this.addToken(TokenType.CLOSE_TUPLE, position);
          break;

        // Block delimiters
        case "{":
          this.addToken(TokenType.OPEN_BLOCK, position);
          break;
        case "}":
          this.addToken(TokenType.CLOSE_BLOCK, position);
          break;

        // Expression delimiters
        case "[":
          this.addToken(TokenType.OPEN_EXPRESSION, position);
          break;
        case "]":
          this.addToken(TokenType.CLOSE_EXPRESSION, position);
          break;

        // String delimiter
        case '"':
          while (!this.stream.end() && this.stream.current() == '"') {
            this.stream.next();
          }
          this.addToken(TokenType.STRING_DELIMITER, position);
          break;

        // Dollar
        case "$":
          this.addToken(TokenType.DOLLAR, position);
          break;

        // Semicolon
        case ";":
          this.addToken(TokenType.SEMICOLON, position);
          break;

        // Asterisk
        case "*":
          this.addToken(TokenType.ASTERISK, position);
          break;

        default:
          this.addText(position);
      }
    }

    return this.tokens;
  }

  /**
   * Add token to result
   *
   * @param type     - Token type
   * @param position - Position of first character
   * @param literal  - Literal value
   */
  private addToken(type: TokenType, position: Position, literal?: string) {
    const sequence = this.stream.range(
      position.index,
      this.stream.position.index
    );
    this.tokens.push({
      type,
      position,
      sequence,
      literal: literal ?? sequence,
    });
  }

  /**
   * Add character sequence to new or existing text token
   *
   * Added character sequence is between given position and current stream
   * position
   *
   * @param position - Position of first character to add
   */
  private addText(position: Position) {
    const last = this.tokens[this.tokens.length - 1];
    const literal = this.stream.range(
      position.index,
      this.stream.position.index
    );
    if (last?.type != TokenType.TEXT) {
      this.addToken(TokenType.TEXT, position, literal);
    } else {
      last.literal += literal;
      last.sequence = this.stream.range(
        last.position.index,
        this.stream.position.index
      );
    }
  }

  /**
   * Predicate for whitespace characters (excluding newlines)
   *
   * @param c - Character to test
   *
   * @returns   Whether character is a whitespace
   */
  private isWhitespace(c: string) {
    return c.match(/[ \t\r\f]/);
  }

  /**
   * Predicate for escape characters
   *
   * @param c - Character to test
   *
   * @returns   Whether character is a known escape
   */
  private isEscape(c: string) {
    return c.match(/[abfnrtv\\]/);
  }

  /**
   * Get escaped character
   *
   * @param c - Character to escape
   *
   * @returns   Escaped character
   */
  private getEscape(c: string) {
    return {
      a: "\x07",
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
      "\\": "\\",
    }[c];
  }

  /**
   * Predicate for octal characters
   *
   * @param c - Character to test
   *
   * @returns   Whether character is octal
   */
  private isOctal(c: string) {
    return c.match(/[0-7]/);
  }

  /**
   * Predicate for hexadecimal characters
   *
   * @param c - Character to test
   *
   * @returns   Whether character is hexadecimal
   */
  private isHexadecimal(c: string) {
    return c.match(/[0-9a-fA-F]/);
  }
}

/**
 * String-based character stream
 */
class StringStream {
  /** Source string */
  readonly source: string;

  /** Current position in stream */
  readonly position: Position = new Position();

  /**
   * Create a new stream from a string
   *
   * @param source - Source string
   */
  constructor(source: string) {
    this.source = source;
  }

  /**
   * At end predicate
   *
   * @returns Whether stream is at end
   */
  end() {
    return this.position.index >= this.source.length;
  }

  /**
   * Advance to next character
   *
   * @returns Character at previous position
   */
  next() {
    return this.source[this.position.next(this.current() === "\n")];
  }

  /**
   * Get current character
   *
   * @returns Character at current position
   */
  current() {
    return this.source[this.position.index];
  }

  /**
   * Get range of characters
   *
   * @param start - First character index (inclusive)
   * @param end   - Last character index (exclusive)
   *
   * @returns       Range of characters
   */
  range(start: number, end: number) {
    return this.source.substring(start, end);
  }
}
