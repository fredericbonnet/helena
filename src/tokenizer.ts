export enum TokenType {
  WHITESPACE,
  NEWLINE,
  CONTINUATION,
  TEXT,
  ESCAPE,
  COMMENT,
  OPEN_LIST,
  CLOSE_LIST,
  OPEN_BLOCK,
  CLOSE_BLOCK,
  OPEN_COMMAND,
  CLOSE_COMMAND,
  STRING_DELIMITER,
  DOLLAR,
  SEMICOLON,
  ASTERISK,
}

export class Position {
  index: number = 0;
  line: number = 0;
  column: number = 0;

  copy() {
    const copy = new Position();
    copy.index = this.index;
    copy.line = this.line;
    copy.column = this.column;
    return copy;
  }
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

export interface Token {
  type: TokenType;
  position: Position;
  sequence: string;
  literal: string;
}

export class Tokenizer {
  tokenize(source: string): Token[] {
    let stream = new StringStream(source);
    let tokens: Token[] = [];

    function addToken(type: TokenType, position: Position, literal?: string) {
      const sequence = stream.range(position.index, stream.position.index);
      tokens.push({
        type,
        position,
        sequence,
        literal: literal ?? sequence,
      });
    }

    function addText(position: Position) {
      const last = tokens[tokens.length - 1];
      const literal = stream.range(position.index, stream.position.index);
      if (last?.type != TokenType.TEXT) {
        addToken(TokenType.TEXT, position, literal);
      } else {
        last.literal += literal;
        last.sequence = stream.range(
          last.position.index,
          stream.position.index
        );
      }
    }

    while (!stream.end()) {
      const position = stream.position.copy();
      const c = stream.next();
      switch (c) {
        // Whitespaces
        case " ":
        case "\t":
        case "\r":
        case "\f":
          while (!stream.end() && this.isWhitespace(stream.current())) {
            stream.next();
          }
          addToken(TokenType.WHITESPACE, position);
          break;

        // Newline
        case "\n":
          addToken(TokenType.NEWLINE, position);
          break;

        // Escape sequence
        case "\\":
          if (stream.end()) {
            addToken(TokenType.TEXT, position);
            break;
          }
          const e = stream.next();
          if (e == "\n") {
            addToken(TokenType.CONTINUATION, position, " ");
            break;
          }
          let escape = e; // Default value for unrecognized sequences
          if (this.isEscape(e)) {
            escape = this.getEscape(e);
          } else if (this.isOctal(e)) {
            let codepoint = Number.parseInt(e);
            let i = 1;
            while (!stream.end() && this.isOctal(stream.current()) && i < 3) {
              codepoint *= 8;
              codepoint += Number.parseInt(stream.current());
              stream.next();
              i++;
            }
            escape = String.fromCharCode(codepoint);
          } else if (e == "x") {
            let codepoint = 0;
            let i = 0;
            while (
              !stream.end() &&
              this.isHexadecimal(stream.current()) &&
              i < 2
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + stream.current());
              stream.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          } else if (e == "u") {
            let codepoint = 0;
            let i = 0;
            while (
              !stream.end() &&
              this.isHexadecimal(stream.current()) &&
              i < 4
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + stream.current());
              stream.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          } else if (e == "U") {
            let codepoint = 0;
            let i = 0;
            while (
              !stream.end() &&
              this.isHexadecimal(stream.current()) &&
              i < 8
            ) {
              codepoint *= 16;
              codepoint += Number.parseInt("0x" + stream.current());
              stream.next();
              i++;
            }
            if (i > 0) {
              escape = String.fromCharCode(codepoint);
            }
          }
          addToken(TokenType.ESCAPE, position, escape);
          break;

        // Comment
        case "#":
          while (!stream.end() && stream.current() == "#") {
            stream.next();
          }
          addToken(TokenType.COMMENT, position);
          break;

        // List delimiters
        case "(":
          addToken(TokenType.OPEN_LIST, position);
          break;
        case ")":
          addToken(TokenType.CLOSE_LIST, position);
          break;

        // Block delimiters
        case "{":
          addToken(TokenType.OPEN_BLOCK, position);
          break;
        case "}":
          addToken(TokenType.CLOSE_BLOCK, position);
          break;

        // Command delimiters
        case "[":
          addToken(TokenType.OPEN_COMMAND, position);
          break;
        case "]":
          addToken(TokenType.CLOSE_COMMAND, position);
          break;

        // String delimiter
        case '"':
          while (!stream.end() && stream.current() == '"') {
            stream.next();
          }
          addToken(TokenType.STRING_DELIMITER, position);
          break;

        // Dollar
        case "$":
          addToken(TokenType.DOLLAR, position);
          break;

        // Semicolon
        case ";":
          addToken(TokenType.SEMICOLON, position);
          break;

        // Asterisk
        case "*":
          addToken(TokenType.ASTERISK, position);
          break;

        default:
          addText(position);
      }
    }

    return tokens;
  }

  isWhitespace(c: string) {
    return c.match(/[ \t\r\f]/);
  }
  isEscape(c: string) {
    return c.match(/[abfnrtv\\]/);
  }
  getEscape(c: string) {
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
  isOctal(c: string) {
    return c.match(/[0-7]/);
  }
  isHexadecimal(c: string) {
    return c.match(/[0-9a-fA-F]/);
  }
}

class StringStream {
  source: string;
  position: Position = new Position();
  constructor(source: string) {
    this.source = source;
  }

  end() {
    return this.position.index >= this.source.length;
  }
  next() {
    return this.source[this.position.next(this.current() === "\n")];
  }
  current() {
    return this.source[this.position.index];
  }
  peek() {
    return this.source[this.position.index + 1];
  }
  range(start: number, end: number) {
    return this.source.substring(start, end);
  }
}
