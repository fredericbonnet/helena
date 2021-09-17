import { Token, TokenType } from "./tokenizer";

export enum SyllableType {
  LITERAL,
  LIST,
  BLOCK,
  COMMAND,
  STRING,
  HERESTRING,
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
  type: SyllableType = SyllableType.HERESTRING;
  syllables: Syllable[] = [];
  delimiterLength: number;
  parentContext?;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}

type SubscriptSyllable = ListSyllable | BlockSyllable | CommandSyllable;
type RecursiveSyllable =
  | SubscriptSyllable
  | StringSyllable
  | HereStringSyllable;
export type Syllable = LiteralSyllable | RecursiveSyllable;

export class Word {
  syllables: Syllable[] = [];
}
export class Command {
  words: Word[] = [];
}
export class Script {
  commands: Command[] = [];
}

class Context {
  parent: RecursiveSyllable;
  script: Script;
  command: Command;
  word: Word;
  syllable: Syllable;

  constructor(ctx: Partial<Context>) {
    this.parent = ctx.parent;
    this.script = ctx.script;
    this.command = ctx.command;
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

        case SyllableType.HERESTRING:
          this.parseHereString(token);
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
        case SyllableType.HERESTRING:
          throw new Error("unmatched herestring delimiter");
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
        this.closeSubcommand();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openSubcommand() {
    this.context.syllable = new CommandSyllable();
    this.context.word.syllables.push(this.context.syllable);
    this.pushContext(this.context.syllable, {
      script: this.context.syllable.subscript,
    });
  }
  private closeSubcommand() {
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
        this.closeCommand();
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
          // Special case for empty strings
          this.openString();
          this.closeString();
        } else {
          // Herestrings
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
        this.openSubcommand();
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
    if (!this.context.command) {
      this.context.command = new Command();
      this.context.script.commands.push(this.context.command);
      this.context.word = undefined;
    }
    if (!this.context.word) {
      this.context.word = new Word();
      this.context.command.words.push(this.context.word);
      this.context.syllable = undefined;
    }
  }
  private addLiteral(value: string) {
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      (this.context.syllable as LiteralSyllable).value += value;
    } else {
      this.context.syllable = new LiteralSyllable();
      (this.context.syllable as LiteralSyllable).value = value;
      this.context.word.syllables.push(this.context.syllable);
    }
  }
  private closeWord() {
    this.context.syllable = undefined;
    this.context.word = undefined;
  }
  private closeCommand() {
    this.closeWord();
    this.context.command = undefined;
  }

  /*
   * Strings
   */

  private parseString(token: Token) {
    switch (token.type) {
      case TokenType.STRING_DELIMITER:
        this.closeString();
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
      command: this.context.command,
      word: this.context.word,
    });
  }
  private closeString() {
    this.popContext();
  }
  private addStringSequence(value: string) {
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      (this.context.syllable as LiteralSyllable).value += value;
    } else {
      this.context.syllable = new LiteralSyllable();
      (this.context.syllable as LiteralSyllable).value = value;
      (this.context.parent as StringSyllable).syllables.push(
        this.context.syllable
      );
    }
  }

  /*
   * Herestrings
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
      command: this.context.command,
      word: this.context.word,
    });
  }
  private closeHereString(sequence: string) {
    if (
      sequence.length >=
      (this.context.parent as HereStringSyllable).delimiterLength
    ) {
      const extra =
        sequence.length -
        (this.context.parent as HereStringSyllable).delimiterLength;
      if (extra > 0) {
        // End delimiter is longer, append extra characters
        this.addHereStringSequence(sequence.substr(0, extra));
      }
      this.popContext();
      return true;
    }
  }
  private addHereStringSequence(value: string) {
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      (this.context.syllable as LiteralSyllable).value += value;
    } else {
      this.context.syllable = new LiteralSyllable();
      (this.context.syllable as LiteralSyllable).value = value;
      (this.context.parent as HereStringSyllable).syllables.push(
        this.context.syllable
      );
    }
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
