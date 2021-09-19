import { Token, TokenType } from "./tokenizer";

export enum SyllableType {
  LITERAL,
  LIST,
  BLOCK,
  COMMAND,
  STRING,
  HERE_STRING,
  TAGGED_STRING,
}

export class LiteralSyllable {
  type: SyllableType = SyllableType.LITERAL;
  value: string;
}
export class ListSyllable {
  type: SyllableType = SyllableType.LIST;
  subscript: Script = new Script();
  parentContext?;
}
export class BlockSyllable {
  type: SyllableType = SyllableType.BLOCK;
  subscript: Script = new Script();
  parentContext?;
}
export class CommandSyllable {
  type: SyllableType = SyllableType.COMMAND;
  subscript: Script = new Script();
  parentContext?;
}
export class StringSyllable {
  type: SyllableType = SyllableType.STRING;
  syllables: Syllable[] = [];
  parentContext?;
}
export class HereStringSyllable {
  type: SyllableType = SyllableType.HERE_STRING;
  value: string = "";
  delimiterLength: number;
  parentContext?;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}
export class TaggedStringSyllable {
  type: SyllableType = SyllableType.TAGGED_STRING;
  value: string = "";
  delimiter: string;
  parentContext?;

  constructor(delimiter: string) {
    this.delimiter = delimiter;
  }
}

type SubscriptSyllable = ListSyllable | BlockSyllable | CommandSyllable;
type RecursiveSyllable =
  | SubscriptSyllable
  | StringSyllable
  | HereStringSyllable
  | TaggedStringSyllable;
export type Syllable = LiteralSyllable | RecursiveSyllable;

export class Word {
  syllables: Syllable[] = [];
}
export class Sentence {
  words: Word[] = [];
}
export class Script {
  sentences: Sentence[] = [];
}

class Context {
  parent: RecursiveSyllable;
  script: Script;
  sentence: Sentence;
  word: Word;
  syllable: Syllable;

  constructor(ctx: Partial<Context>) {
    this.parent = ctx.parent;
    this.script = ctx.script;
    this.sentence = ctx.sentence;
    this.word = ctx.word;
  }
}
export class Parser {
  private stream: TokenStream;
  private context: Context;

  parse(tokens: Token[]) {
    this.stream = new TokenStream(tokens);
    this.context = new Context({
      script: new Script(),
    });

    while (!this.stream.end()) {
      const token = this.stream.next();
      switch (this.context.parent?.type) {
        case SyllableType.LIST:
          this.parseList(token);
          break;

        case SyllableType.BLOCK:
          this.parseBlock(token);
          break;

        case SyllableType.COMMAND:
          this.parseCommand(token);
          break;

        case SyllableType.STRING:
          this.parseString(token);
          break;

        case SyllableType.HERE_STRING:
          this.parseHereString(token);
          break;

        case SyllableType.TAGGED_STRING:
          this.parseTaggedString(token);
          break;

        default:
          this.parseScript(token);
      }
    }

    if (this.context.parent) {
      switch (this.context.parent.type) {
        case SyllableType.LIST:
          throw new Error("unmatched left parenthesis");
        case SyllableType.BLOCK:
          throw new Error("unmatched left brace");
        case SyllableType.COMMAND:
          throw new Error("unmatched left bracket");
        case SyllableType.STRING:
          throw new Error("unmatched string delimiter");
        case SyllableType.HERE_STRING:
          throw new Error("unmatched here-string delimiter");
        default:
          throw new Error("unterminated script");
      }
    }

    return this.context.script;
  }

  private pushContext(syllable: RecursiveSyllable, ctx: Partial<Context>) {
    syllable.parentContext = this.context;
    this.context = new Context({ ...ctx, parent: syllable });
  }
  private popContext() {
    let syllable = this.context.parent;
    this.context = syllable.parentContext;
    syllable.parentContext = undefined;
  }

  /*
   * Scripts
   */

  private parseScript(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_LIST:
        throw new Error("unmatched right parenthesis");

      case TokenType.CLOSE_BLOCK:
        throw new Error("unmatched right brace");

      case TokenType.CLOSE_COMMAND:
        throw new Error("unmatched right bracket");

      default:
        this.parseWord(token);
    }
  }

  /*
   * Lists
   */

  private parseList(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_LIST:
        this.closeList();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openList() {
    this.context.syllable = new ListSyllable();
    this.context.word.syllables.push(this.context.syllable);
    this.pushContext(this.context.syllable, {
      script: this.context.syllable.subscript,
    });
  }
  private closeList() {
    this.popContext();
  }

  /*
   * Blocks
   */

  private parseBlock(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_BLOCK:
        this.closeBlock();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openBlock() {
    this.context.syllable = new BlockSyllable();
    this.context.word.syllables.push(this.context.syllable);
    this.pushContext(this.context.syllable, {
      script: this.context.syllable.subscript,
    });
  }
  private closeBlock() {
    this.popContext();
  }

  /*
   * Commands
   */
  private parseCommand(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_COMMAND:
        this.closeCommand();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openCommand() {
    this.context.syllable = new CommandSyllable();
    this.context.word.syllables.push(this.context.syllable);
    this.pushContext(this.context.syllable, {
      script: this.context.syllable.subscript,
    });
  }
  private closeCommand() {
    this.popContext();
  }

  /*
   * Words
   */

  private parseWord(token: Token) {
    switch (token.type) {
      case TokenType.WHITESPACE:
      case TokenType.CONTINUATION:
        this.closeWord();
        break;

      case TokenType.NEWLINE:
      case TokenType.SEMICOLON:
        this.closeSentence();
        break;

      case TokenType.TEXT:
      case TokenType.ESCAPE:
        this.ensureWord();
        this.addLiteral(token.literal);
        break;

      case TokenType.STRING_DELIMITER:
        if (this.context.word) {
          throw new Error("unexpected string delimiter");
        }
        this.ensureWord();
        if (token.literal == '"') {
          // Regular strings
          this.openString();
        } else if (token.literal == '""') {
          const next = this.stream.current();
          if (next?.type == TokenType.TEXT) {
            // Tagged strings
            this.openTaggedString(next.literal);
          } else {
            // Special case for empty strings
            this.openString();
            this.closeString();
          }
        } else {
          // Here-strings
          this.openHereString(token.literal);
        }
        break;

      case TokenType.OPEN_LIST:
        this.ensureWord();
        this.openList();
        break;

      case TokenType.OPEN_BLOCK:
        this.ensureWord();
        this.openBlock();
        break;

      case TokenType.OPEN_COMMAND:
        this.ensureWord();
        this.openCommand();
        break;

      case TokenType.CLOSE_LIST:
        throw new Error("mismatched right parenthesis");

      case TokenType.CLOSE_BLOCK:
        throw new Error("mismatched right brace");

      case TokenType.CLOSE_COMMAND:
        throw new Error("mismatched right bracket");

      default:
        throw new Error("syntax error");
    }
  }
  private ensureWord() {
    if (!this.context.sentence) {
      this.context.sentence = new Sentence();
      this.context.script.sentences.push(this.context.sentence);
      this.context.word = undefined;
    }
    if (!this.context.word) {
      this.context.word = new Word();
      this.context.sentence.words.push(this.context.word);
      this.context.syllable = undefined;
    }
  }
  private addLiteral(value: string) {
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      (this.context.syllable as LiteralSyllable).value += value;
    } else {
      this.context.syllable = new LiteralSyllable();
      this.context.syllable.value = value;
      this.context.word.syllables.push(this.context.syllable);
    }
  }
  private closeWord() {
    this.context.syllable = undefined;
    this.context.word = undefined;
  }
  private closeSentence() {
    this.closeWord();
    this.context.sentence = undefined;
  }

  /*
   * Strings
   */

  private parseString(token: Token) {
    switch (token.type) {
      case TokenType.STRING_DELIMITER:
        this.closeString();
        break;

      case TokenType.CONTINUATION:
        this.addStringSequence(token.literal);
        // Eat up all subsequent whitespaces
        while (this.stream.current()?.type == TokenType.WHITESPACE) {
          this.stream.next();
        }
        break;

      default:
        this.addStringSequence(token.literal);
    }
  }
  private openString() {
    this.context.syllable = new StringSyllable();
    this.context.word.syllables.push(this.context.syllable);
    this.pushContext(this.context.syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
  }
  private closeString() {
    this.popContext();
  }
  private addStringSequence(value: string) {
    const parent = this.context.parent as StringSyllable;
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      (this.context.syllable as LiteralSyllable).value += value;
    } else {
      this.context.syllable = new LiteralSyllable();
      this.context.syllable.value = value;
      parent.syllables.push(this.context.syllable);
    }
  }

  /*
   * Here-strings
   */

  private parseHereString(token: Token) {
    switch (token.type) {
      case TokenType.STRING_DELIMITER:
        if (this.closeHereString(token.sequence)) break;
      /* continued */

      default:
        this.addHereStringSequence(token.sequence);
    }
  }
  private openHereString(delimiter: string) {
    const syllable = new HereStringSyllable(delimiter);
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
  }
  private closeHereString(delimiter: string) {
    const parent = this.context.parent as HereStringSyllable;
    if (delimiter.length != parent.delimiterLength) {
      return false;
    }
    this.popContext();
    return true;
  }
  private addHereStringSequence(value: string) {
    const parent = this.context.parent as HereStringSyllable;
    parent.value += value;
  }

  /*
   * Tagged strings
   */

  private parseTaggedString(token: Token) {
    switch (token.type) {
      case TokenType.TEXT:
        if (this.closeTaggedString(token.literal)) break;
      /* continued */

      default:
        this.addTaggedStringSequence(token.sequence);
    }
  }
  private openTaggedString(delimiter: string) {
    const syllable = new TaggedStringSyllable(delimiter);
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });

    // Discard everything until the next newline
    while (this.stream.next()?.type != TokenType.NEWLINE);
  }
  private closeTaggedString(delimiter: string) {
    const parent = this.context.parent as TaggedStringSyllable;
    if (delimiter == parent.delimiter) {
      const next = this.stream.current();
      if (
        next?.type == TokenType.STRING_DELIMITER &&
        next.literal.length == 2
      ) {
        this.stream.next();

        // Shift lines by prefix length
        const lines = parent.value.split("\n");
        const prefix = lines[lines.length - 1];
        parent.value = lines
          .map((line) => line.substr(prefix.length))
          .join("\n");

        this.popContext();
        return true;
      }
    }
    return false;
  }
  private addTaggedStringSequence(value: string) {
    const parent = this.context.parent as TaggedStringSyllable;
    parent.value += value;
  }
}

class TokenStream {
  tokens: Token[];
  index: number = 0;
  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  end() {
    return this.index >= this.tokens.length;
  }
  next() {
    return this.tokens[this.index++];
  }
  current() {
    return this.tokens[this.index];
  }
  peek() {
    return this.tokens[this.index + 1];
  }
}
