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

export class Tokenizer {
  tokenize(source: string) {
    let stream = new StringStream(source);
    let tokens = [];

    function addText() {
      if (tokens[tokens.length - 1] != TokenType.TEXT) {
        tokens.push(TokenType.TEXT);
      }
    }

    while (!stream.end()) {
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
          tokens.push(TokenType.WHITESPACE);
          break;

        // Newline
        case "\n":
          tokens.push(TokenType.NEWLINE);
          break;

        // Escape sequence
        case "\\":
          if (stream.end()) {
            tokens.push(TokenType.TEXT);
            break;
          }
          if (stream.current() == "\n") {
            stream.next();
            while (!stream.end() && this.isWhitespace(stream.current())) {
              stream.next();
            }
            tokens.push(TokenType.CONTINUATION);
            break;
          }
          if (this.isEscape(stream.current())) {
            stream.next();
            tokens.push(TokenType.ESCAPE);
            break;
          }
          if (this.isOctal(stream.current())) {
            stream.next();
            let i = 1;
            while (!stream.end() && this.isOctal(stream.current()) && i < 3) {
              stream.next();
              i++;
            }
            tokens.push(TokenType.ESCAPE);
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
              tokens.push(TokenType.ESCAPE);
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
              tokens.push(TokenType.ESCAPE);
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
              tokens.push(TokenType.ESCAPE);
              break;
            }
          }
          stream.next();
          addText();
          break;

        // Comment
        case "#":
          while (!stream.end() && stream.current() == "#") {
            stream.next();
          }
          tokens.push(TokenType.COMMENT);
          break;

        // List delimiters
        case "(":
          tokens.push(TokenType.OPEN_LIST);
          break;
        case ")":
          tokens.push(TokenType.CLOSE_LIST);
          break;

        // Block delimiters
        case "{":
          tokens.push(TokenType.OPEN_BLOCK);
          break;
        case "}":
          tokens.push(TokenType.CLOSE_BLOCK);
          break;

        // Command delimiters
        case "[":
          tokens.push(TokenType.OPEN_COMMAND);
          break;
        case "]":
          tokens.push(TokenType.CLOSE_COMMAND);
          break;

        // String delimiter
        case '"':
          tokens.push(TokenType.STRING_DELIMITER);
          break;

        // Dollar
        case "$":
          tokens.push(TokenType.DOLLAR);
          break;

        // Semicolon
        case ";":
          tokens.push(TokenType.SEMICOLON);

          break;

        default:
          addText();
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
  position: number = 0;
  constructor(source: string) {
    this.source = source;
  }

  end() {
    return this.position >= this.source.length;
  }
  next() {
    return this.source[this.position++];
  }
  current() {
    return this.source[this.position];
  }
  peek() {
    return this.source[this.position + 1];
  }
}
