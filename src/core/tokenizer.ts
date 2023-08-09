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
 * Position in source stream
 */
export class SourcePosition {
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
    const copy = new SourcePosition();
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
  position: SourcePosition;

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
  private input: SourceStream;

  /** Output tokens */
  private output: TokenStream;

  /** Current token */
  private currentToken: Token;

  /**
   * Tokenize a Helena source string into a token array
   *
   * @param source - Source string
   *
   * @returns        Array of tokens
   */
  tokenize(source: string): Token[] {
    const input = new StringStream(source);
    const output = new ArrayTokenStream([]);
    this.tokenizeStream(input, output);
    return output.tokens;
  }

  /**
   * Tokenize a Helena source stream into a token stream
   *
   * @param input  - Input source stream
   * @param output - Output token stream
   */
  tokenizeStream(input: SourceStream, output: TokenStream) {
    this.input = input;
    this.output = output;
    this.currentToken = null;

    while (!this.input.end()) {
      const position = this.input.currentPosition();
      const c = this.input.next();
      switch (c) {
        // Whitespaces
        case " ":
        case "\t":
        case "\r":
        case "\f":
          while (!this.input.end() && this.isWhitespace(this.input.current())) {
            this.input.next();
          }
          this.addToken(TokenType.WHITESPACE, position);
          break;

        // Newline
        case "\n":
          this.addToken(TokenType.NEWLINE, position);
          break;

        // Escape sequence
        case "\\": {
          if (this.input.end()) {
            this.addToken(TokenType.TEXT, position);
            break;
          }
          const e = this.input.next();
          if (e == "\n") {
            // Continuation, eat up all subsequent whitespaces
            while (
              !this.input.end() &&
              this.isWhitespace(this.input.current())
            ) {
              this.input.next();
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
              !this.input.end() &&
              this.isOctal(this.input.current()) &&
              i < 3
            ) {
              codepoint *= 8;
              codepoint += Number.parseInt(this.input.current());
              this.input.next();
              i++;
            }
            escape = String.fromCharCode(codepoint);
          } else if (e == "x") {
            let codepoint = 0;
            let i = 0;
            while (
              !this.input.end() &&
              this.isHexadecimal(this.input.current()) &&
              i < 2
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + this.input.current());
              this.input.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          } else if (e == "u") {
            let codepoint = 0;
            let i = 0;
            while (
              !this.input.end() &&
              this.isHexadecimal(this.input.current()) &&
              i < 4
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + this.input.current());
              this.input.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          } else if (e == "U") {
            let codepoint = 0;
            let i = 0;
            while (
              !this.input.end() &&
              this.isHexadecimal(this.input.current()) &&
              i < 8
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + this.input.current());
              this.input.next();
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
          while (!this.input.end() && this.input.current() == "#") {
            this.input.next();
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
          while (!this.input.end() && this.input.current() == '"') {
            this.input.next();
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

    this.emitToken();
  }

  /**
   * Emit current token to the output stream.
   */
  private emitToken() {
    if (this.currentToken) {
      this.output.emit(this.currentToken);
    }
    this.currentToken = null;
  }

  /**
   * Add token to result
   *
   * @param type     - Token type
   * @param position - Position of first character
   * @param literal  - Literal value
   */
  private addToken(
    type: TokenType,
    position: SourcePosition,
    literal?: string
  ) {
    this.emitToken();
    const sequence = this.input.range(
      position.index,
      this.input.currentIndex()
    );
    this.currentToken = {
      type,
      position,
      sequence,
      literal: literal ?? sequence,
    };
  }

  /**
   * Add character sequence to new or existing text token
   *
   * Added character sequence is between given position and current stream
   * position
   *
   * @param position - Position of first character to add
   */
  private addText(position: SourcePosition) {
    const literal = this.input.range(position.index, this.input.currentIndex());
    if (this.currentToken?.type != TokenType.TEXT) {
      this.addToken(TokenType.TEXT, position, literal);
    } else {
      this.currentToken.literal += literal;
      this.currentToken.sequence = this.input.range(
        this.currentToken.position.index,
        this.input.currentIndex()
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
 * Source stream (input)
 */
export interface SourceStream {
  /**
   * At end predicate
   *
   * @returns Whether stream is at end
   */
  end(): boolean;

  /**
   * Advance to next character
   *
   * @returns Character at previous position
   */
  next(): string;

  /**
   * Get current character
   *
   * @returns Character at current position
   */
  current(): string;

  /**
   * Get range of characters
   *
   * @param start - First character index (inclusive)
   * @param end   - Last character index (exclusive)
   *
   * @returns       Range of characters
   */
  range(start: number, end: number): string;

  /**
   * Get current character index
   *
   * @returns Current index
   */
  currentIndex(): number;

  /**
   * Get current character position
   *
   * @returns Current position
   */
  currentPosition(): SourcePosition;
}

/**
 * String-based character stream
 */
export class StringStream implements SourceStream {
  /** Source string */
  private readonly source: string;

  /** Current input position in stream */
  private readonly position: SourcePosition = new SourcePosition();

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

  /**
   * Get current character index
   *
   * @returns Current index
   */
  currentIndex() {
    return this.position.index;
  }

  /**
   * Get current character position
   *
   * @returns Current position
   */
  currentPosition() {
    return this.position.copy();
  }
}

/**
 * Token stream (input/output)
 */
export interface TokenStream {
  /**
   * Emit (add) token to end of stream
   *
   * @param token - Token to emit
   */
  emit(token: Token);

  /**
   * At end predicate
   *
   * @returns Whether stream is at end
   */
  end(): boolean;

  /**
   * Advance to next token
   *
   * @returns Token at previous position
   */
  next(): Token;

  /**
   * Get current token
   *
   * @returns Token at current position
   */
  current(): Token;

  /**
   * Get range of tokens
   *
   * @param start - First token index (inclusive)
   * @param end   - Last token index (exclusive)
   *
   * @returns       Range of tokens
   */
  range(start: number, end: number): Token[];

  /**
   * Get current token index
   *
   * @returns Current index
   */
  currentIndex(): number;
}

/**
 * Array-based token stream
 */
export class ArrayTokenStream implements TokenStream {
  /** Emitted tokens */
  readonly tokens: Token[];

  /** Current input position in stream */
  index = 0;

  /**
   * Create a new stream from an array of tokens
   *
   * @param tokens - Source array
   */
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  /**
   * Emit (add) token to end of stream
   *
   * @param token - Token to emit
   */
  emit(token: Token) {
    this.tokens.push(token);
  }

  /**
   * At end predicate
   *
   * @returns Whether stream is at end
   */
  end() {
    return this.index >= this.tokens.length;
  }

  /**
   * Advance to next token
   *
   * @returns Token at previous position
   */
  next() {
    return this.tokens[this.index++];
  }

  /**
   * Get current token
   *
   * @returns Token at current position
   */
  current() {
    return this.tokens[this.index];
  }

  /**
   * Get range of tokens
   *
   * @param start - First token index (inclusive)
   * @param end   - Last token index (exclusive)
   *
   * @returns       Range of tokens
   */
  range(start: number, end: number) {
    return this.tokens.slice(start, end);
  }

  /**
   * Get current token index
   *
   * @returns Current index
   */
  currentIndex() {
    return this.index;
  }
}
