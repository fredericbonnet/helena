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
  length: number;
}

export class Tokenizer {
  tokenize(source: string) {
    let stream = new StringStream(source);
    let tokens: Token[] = [];

    function addToken(type: TokenType, position: Position) {
      tokens.push({
        type,
        position,
        length: stream.position.index - position.index,
      });
    }

    function addText(position: Position) {
      const last = tokens[tokens.length - 1];
      if (last?.type != TokenType.TEXT) {
        addToken(TokenType.TEXT, position);
      } else {
        last.length = stream.position.index - last.position.index;
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
          if (stream.current() == "\n") {
            stream.next();
            while (!stream.end() && this.isWhitespace(stream.current())) {
              stream.next();
            }
            addToken(TokenType.CONTINUATION, position);
            break;
          }
          if (this.isEscape(stream.current())) {
            stream.next();
            addToken(TokenType.ESCAPE, position);
            break;
          }
          if (this.isOctal(stream.current())) {
            stream.next();
            let i = 1;
            while (!stream.end() && this.isOctal(stream.current()) && i < 3) {
              stream.next();
              i++;
            }
            addToken(TokenType.ESCAPE, position);
            break;
          }
          if (stream.current() == "x") {
            stream.next();
            let i = 0;
            while (
              !stream.end() &&
              this.isHexadecimal(stream.current()) &&
              i < 2
            ) {
              stream.next();
              i++;
            }
            if (i > 0) {
              addToken(TokenType.ESCAPE, position);
              break;
            }
          }
          if (stream.current() == "u") {
            stream.next();
            let i = 0;
            while (
              !stream.end() &&
              this.isHexadecimal(stream.current()) &&
              i < 4
            ) {
              stream.next();
              i++;
            }
            if (i > 0) {
              addToken(TokenType.ESCAPE, position);
              break;
            }
          }
          if (stream.current() == "U") {
            stream.next();
            let i = 0;
            while (
              !stream.end() &&
              this.isHexadecimal(stream.current()) &&
              i < 8
            ) {
              stream.next();
              i++;
            }
            if (i > 0) {
              addToken(TokenType.ESCAPE, position);
              break;
            }
          }
          stream.next();
          addText(position);
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
}
