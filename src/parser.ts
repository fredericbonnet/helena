import { Token, TokenType } from "./tokenizer";

export enum SyllableType {
  LITERAL,
  LIST,
  BLOCK,
  COMMAND,
  STRING,
  HERE_STRING,
  TAGGED_STRING,
  LINE_COMMENT,
  BLOCK_COMMENT,
  SUBSTITUTE_NEXT,
}

export class LiteralSyllable {
  type: SyllableType = SyllableType.LITERAL;
  value: string;
  substituted: boolean = false;
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
  tag: string;
  parentContext?;

  constructor(tag: string) {
    this.tag = tag;
  }
}
export class LineCommentSyllable {
  type: SyllableType = SyllableType.LINE_COMMENT;
  value: string = "";
  delimiterLength: number;
  parentContext?;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}
export class BlockCommentSyllable {
  type: SyllableType = SyllableType.BLOCK_COMMENT;
  value: string = "";
  delimiterLength: number;
  nesting: number = 1;
  parentContext?;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}
export class SubstituteNextSyllable {
  type: SyllableType = SyllableType.SUBSTITUTE_NEXT;
  expansion: boolean = false;
  nesting: number = 1;
  value: string = "";
}

type ContextualSyllable =
  | ListSyllable
  | BlockSyllable
  | CommandSyllable
  | StringSyllable
  | HereStringSyllable
  | TaggedStringSyllable
  | LineCommentSyllable
  | BlockCommentSyllable;
export type Syllable =
  | LiteralSyllable
  | ContextualSyllable
  | SubstituteNextSyllable;

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
  parent: ContextualSyllable;
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

        case SyllableType.LINE_COMMENT:
          this.parseLineComment(token);
          break;

        case SyllableType.BLOCK_COMMENT:
          this.parseBlockComment(token);
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
        case SyllableType.TAGGED_STRING:
          throw new Error("unmatched tagged string delimiter");
        case SyllableType.LINE_COMMENT:
          this.closeLineComment();
          break;
        case SyllableType.BLOCK_COMMENT:
          throw new Error("unmatched block comment delimiter");
        default:
          throw new Error("unterminated script");
      }
    }
    this.closeSentence();

    return this.context.script;
  }

  private pushContext(syllable: ContextualSyllable, ctx: Partial<Context>) {
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
    const syllable = new ListSyllable();
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: syllable.subscript,
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
    const syllable = new BlockSyllable();
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: syllable.subscript,
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
    const syllable = new CommandSyllable();
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: syllable.subscript,
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
        if (!this.ensureWord()) {
          throw new Error("unexpected string delimiter");
        }
        if (token.literal.length == 1) {
          // Regular strings
          this.openString();
        } else if (token.literal.length == 2) {
          const next = this.stream.current();
          if (next?.type == TokenType.TEXT) {
            // Tagged strings
            this.openTaggedString(next.literal);
          } else {
            // Special case for empty strings
            this.openString();
            this.closeString('"');
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

      case TokenType.COMMENT:
        if (!this.ensureWord()) {
          this.addLiteral(token.literal);
          break;
        }
        if (!this.openBlockComment(token.literal)) {
          this.openLineComment(token.literal);
        }
        break;

      case TokenType.DOLLAR:
        this.ensureWord();
        this.addSubstitution(token.literal);
        break;

      case TokenType.ASTERISK:
        this.ensureWord();
        this.addLiteral(token.literal);
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
    if (this.context.word) return false;
    if (!this.context.sentence) {
      this.context.sentence = new Sentence();
      this.context.script.sentences.push(this.context.sentence);
      this.context.word = undefined;
    }
    this.context.word = new Word();
    this.context.sentence.words.push(this.context.word);
    this.context.syllable = undefined;
    return true;
  }
  private addLiteral(value: string) {
    // Attempt to merge consecutive, non substituted literals
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      const syllable = this.context.syllable as LiteralSyllable;
      if (!syllable.substituted) {
        syllable.value += value;
        return;
      }
    }
    const syllable = new LiteralSyllable();
    syllable.value = value;
    syllable.substituted = this.afterSubstitution();
    this.context.syllable = syllable;
    this.context.word.syllables.push(syllable);
  }
  private closeWord() {
    this.closeSubstitution();
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
      case TokenType.CONTINUATION:
        this.addStringSequence(token.literal);
        // Eat up all subsequent whitespaces
        while (this.stream.current()?.type == TokenType.WHITESPACE) {
          this.stream.next();
        }
        break;

      case TokenType.STRING_DELIMITER:
        if (!this.closeString(token.literal)) {
          throw new Error("extra characters after string delimiter");
        }
        break;

      default:
        this.addStringSequence(token.literal);
    }
  }
  private openString() {
    const syllable = new StringSyllable();
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
  }
  private closeString(delimiter: string) {
    if (delimiter.length != 1) return false;
    this.popContext();
    return true;
  }
  private addStringSequence(value: string) {
    const parent = this.context.parent as StringSyllable;
    if (this.context.syllable?.type == SyllableType.LITERAL) {
      const syllable = this.context.syllable as LiteralSyllable;
      syllable.value += value;
    } else {
      const syllable = new LiteralSyllable();
      syllable.value = value;
      this.context.syllable = syllable;
      parent.syllables.push(syllable);
    }
  }

  /*
   * Here-strings
   */

  private parseHereString(token: Token) {
    switch (token.type) {
      case TokenType.STRING_DELIMITER:
        if (this.closeHereString(token.literal)) break;
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
    if (delimiter.length != parent.delimiterLength) return false;
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
  private openTaggedString(tag: string) {
    const syllable = new TaggedStringSyllable(tag);
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });

    // Discard everything until the next newline
    while (this.stream.next()?.type != TokenType.NEWLINE);
  }
  private closeTaggedString(literal: string) {
    const parent = this.context.parent as TaggedStringSyllable;
    if (literal != parent.tag) return false;
    const next = this.stream.current();
    if (next?.type != TokenType.STRING_DELIMITER) return false;
    if (next.literal.length != 2) return false;
    this.stream.next();

    // Shift lines by prefix length
    const lines = parent.value.split("\n");
    const prefix = lines[lines.length - 1];
    parent.value = lines.map((line) => line.substr(prefix.length)).join("\n");

    this.popContext();
    return true;
  }
  private addTaggedStringSequence(value: string) {
    const parent = this.context.parent as TaggedStringSyllable;
    parent.value += value;
  }

  /*
   * Line comments
   */

  private parseLineComment(token: Token) {
    switch (token.type) {
      case TokenType.NEWLINE:
        this.closeLineComment();
        this.closeSentence();
        break;

      default:
        this.addLineCommentSequence(token.literal);
    }
  }
  private openLineComment(delimiter: string) {
    const syllable = new LineCommentSyllable(delimiter);
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
  }
  private closeLineComment() {
    this.popContext();
  }
  private addLineCommentSequence(value: string) {
    const parent = this.context.parent as LineCommentSyllable;
    parent.value += value;
  }

  /*
   * Block comment
   */

  private parseBlockComment(token: Token) {
    switch (token.type) {
      case TokenType.COMMENT:
        if (!this.openBlockComment(token.literal, true)) {
          this.addBlockCommentSequence(token.sequence);
        }
        break;

      case TokenType.CLOSE_BLOCK:
        if (!this.closeBlockComment()) {
          this.addBlockCommentSequence(token.sequence);
        }
        break;

      default:
        this.addBlockCommentSequence(token.sequence);
    }
  }
  private openBlockComment(delimiter: string, nested = false) {
    if (this.stream.current()?.type != TokenType.OPEN_BLOCK) return false;
    if (nested) {
      const parent = this.context.parent as BlockCommentSyllable;
      if (parent.delimiterLength == delimiter.length) {
        parent.nesting++;
      }
      return false;
    }
    this.stream.next();
    const syllable = new BlockCommentSyllable(delimiter);
    this.context.word.syllables.push(syllable);
    this.pushContext(syllable, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
    return true;
  }
  private closeBlockComment() {
    const parent = this.context.parent as BlockCommentSyllable;
    const token = this.stream.current();
    if (token?.type != TokenType.COMMENT) return false;
    if (token.literal.length != parent.delimiterLength) return false;
    if (--parent.nesting > 0) return false;
    this.stream.next();
    this.popContext();
    return true;
  }
  private addBlockCommentSequence(value: string) {
    const parent = this.context.parent as BlockCommentSyllable;
    parent.value += value;
  }

  /*
   * Substitutions
   */

  private addSubstitution(value: string) {
    if (this.context.syllable?.type == SyllableType.SUBSTITUTE_NEXT) {
      const syllable = this.context.syllable as SubstituteNextSyllable;
      syllable.value += value;
      syllable.nesting++;
      if (this.stream.current()?.type == TokenType.ASTERISK) {
        // Ignore expansion on inner substitutions
        syllable.value += this.stream.next().literal;
      }
    } else {
      const syllable = new SubstituteNextSyllable();
      syllable.value = value;
      if (this.stream.current()?.type == TokenType.ASTERISK) {
        syllable.expansion = true;
        syllable.value += this.stream.next().literal;
      }
      this.context.syllable = syllable;
      this.context.word.syllables.push(syllable);
    }
  }
  private closeSubstitution() {
    if (!this.afterSubstitution()) return;

    // Convert stale substitutions to literals
    const value = (this.context.syllable as SubstituteNextSyllable).value;
    this.context.word.syllables.pop();
    const syllable = new LiteralSyllable();
    syllable.value = value;
    this.context.syllable = syllable;
    this.context.word.syllables.push(syllable);
  }
  private afterSubstitution() {
    return this.context.syllable?.type == SyllableType.SUBSTITUTE_NEXT;
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
