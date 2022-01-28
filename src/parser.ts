import { Token, TokenType } from "./tokenizer";

export enum MorphemeType {
  LITERAL,
  TUPLE,
  BLOCK,
  EXPRESSION,
  STRING,
  HERE_STRING,
  TAGGED_STRING,
  LINE_COMMENT,
  BLOCK_COMMENT,
  SUBSTITUTE_NEXT,
}

export class LiteralMorpheme {
  type: MorphemeType = MorphemeType.LITERAL;
  value: string;
}
export class TupleMorpheme {
  type: MorphemeType = MorphemeType.TUPLE;
  subscript: Script = new Script();
  parentContext?: Context;
}
export class BlockMorpheme {
  type: MorphemeType = MorphemeType.BLOCK;
  subscript: Script = new Script();
  start: number;
  value: string;
  parentContext?: Context;
}
export class ExpressionMorpheme {
  type: MorphemeType = MorphemeType.EXPRESSION;
  subscript: Script = new Script();
  parentContext?: Context;
}
export class StringMorpheme {
  type: MorphemeType = MorphemeType.STRING;
  morphemes: Morpheme[] = [];
  parentContext?: Context;
}
export class HereStringMorpheme {
  type: MorphemeType = MorphemeType.HERE_STRING;
  value: string = "";
  delimiterLength: number;
  parentContext?: Context;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}
export class TaggedStringMorpheme {
  type: MorphemeType = MorphemeType.TAGGED_STRING;
  value: string = "";
  tag: string;
  parentContext?: Context;

  constructor(tag: string) {
    this.tag = tag;
  }
}
export class LineCommentMorpheme {
  type: MorphemeType = MorphemeType.LINE_COMMENT;
  value: string = "";
  delimiterLength: number;
  parentContext?: Context;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}
export class BlockCommentMorpheme {
  type: MorphemeType = MorphemeType.BLOCK_COMMENT;
  value: string = "";
  delimiterLength: number;
  nesting: number = 1;
  parentContext?: Context;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}
export class SubstituteNextMorpheme {
  type: MorphemeType = MorphemeType.SUBSTITUTE_NEXT;
  expansion: boolean = false;
  levels: number = 1;
  value: string = "";
}

type ContextualMorpheme =
  | TupleMorpheme
  | BlockMorpheme
  | ExpressionMorpheme
  | StringMorpheme
  | HereStringMorpheme
  | TaggedStringMorpheme
  | LineCommentMorpheme
  | BlockCommentMorpheme;
export type Morpheme =
  | LiteralMorpheme
  | ContextualMorpheme
  | SubstituteNextMorpheme;

export class Word {
  morphemes: Morpheme[] = [];
}
export class Sentence {
  words: Word[] = [];
}
export class Script {
  sentences: Sentence[] = [];
}

class Context {
  parent: ContextualMorpheme;
  script: Script;
  sentence: Sentence;
  word: Word;
  morphemes: Morpheme[];
  substitutionMode: "" | "expect-source" | "expect-selector";

  constructor(ctx: Partial<Context>) {
    this.parent = ctx.parent;
    this.script = ctx.script;
    this.sentence = ctx.sentence;
    this.word = ctx.word;
    this.morphemes = ctx.morphemes;
  }
  currentMorpheme() {
    return this.morphemes
      ? this.morphemes[this.morphemes.length - 1]
      : undefined;
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
        case MorphemeType.TUPLE:
          this.parseTuple(token);
          break;

        case MorphemeType.BLOCK:
          this.parseBlock(token);
          break;

        case MorphemeType.EXPRESSION:
          this.parseExpression(token);
          break;

        case MorphemeType.STRING:
          this.parseString(token);
          break;

        case MorphemeType.HERE_STRING:
          this.parseHereString(token);
          break;

        case MorphemeType.TAGGED_STRING:
          this.parseTaggedString(token);
          break;

        case MorphemeType.LINE_COMMENT:
          this.parseLineComment(token);
          break;

        case MorphemeType.BLOCK_COMMENT:
          this.parseBlockComment(token);
          break;

        default:
          this.parseScript(token);
      }
    }

    if (this.context.parent) {
      switch (this.context.parent.type) {
        case MorphemeType.TUPLE:
          throw new Error("unmatched left parenthesis");
        case MorphemeType.BLOCK:
          throw new Error("unmatched left brace");
        case MorphemeType.EXPRESSION:
          throw new Error("unmatched left bracket");
        case MorphemeType.STRING:
          throw new Error("unmatched string delimiter");
        case MorphemeType.HERE_STRING:
          throw new Error("unmatched here-string delimiter");
        case MorphemeType.TAGGED_STRING:
          throw new Error("unmatched tagged string delimiter");
        case MorphemeType.LINE_COMMENT:
          this.closeLineComment();
          break;
        case MorphemeType.BLOCK_COMMENT:
          throw new Error("unmatched block comment delimiter");
        default:
          throw new Error("unterminated script");
      }
    }
    this.closeSentence();

    return this.context.script;
  }

  private pushContext(morpheme: ContextualMorpheme, ctx: Partial<Context>) {
    morpheme.parentContext = this.context;
    this.context = new Context({ ...ctx, parent: morpheme });
  }
  private popContext() {
    const morpheme = this.context.parent;
    this.context = morpheme.parentContext;
    morpheme.parentContext = undefined;
  }

  /*
   * Scripts
   */

  private parseScript(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_TUPLE:
        throw new Error("unmatched right parenthesis");

      case TokenType.CLOSE_BLOCK:
        throw new Error("unmatched right brace");

      case TokenType.CLOSE_EXPRESSION:
        throw new Error("unmatched right bracket");

      default:
        this.parseWord(token);
    }
  }

  /*
   * Tuples
   */

  private parseTuple(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_TUPLE:
        this.closeTuple();
        if (this.expectSource()) this.continueSubstitution();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openTuple() {
    const morpheme = new TupleMorpheme();
    this.context.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: morpheme.subscript,
    });
  }
  private closeTuple() {
    this.popContext();
  }

  /*
   * Blocks
   */

  private parseBlock(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_BLOCK:
        this.closeBlock();
        if (this.expectSource()) this.continueSubstitution();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openBlock() {
    const morpheme = new BlockMorpheme();
    morpheme.start = this.stream.index;
    this.context.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: morpheme.subscript,
    });
  }
  private closeBlock() {
    const morpheme = this.context.parent as BlockMorpheme;
    const range = this.stream.range(morpheme.start, this.stream.index - 1);
    morpheme.value = range.map((token) => token.literal).join("");
    this.popContext();
  }

  /*
   * Expressions
   */
  private parseExpression(token: Token) {
    switch (token.type) {
      case TokenType.CLOSE_EXPRESSION:
        this.closeExpression();
        this.continueSubstitution();
        break;

      default:
        this.parseWord(token);
    }
  }
  private openExpression() {
    const morpheme = new ExpressionMorpheme();
    this.context.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: morpheme.subscript,
    });
  }
  private closeExpression() {
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

      case TokenType.OPEN_TUPLE:
        this.ensureWord();
        this.openTuple();
        break;

      case TokenType.OPEN_BLOCK:
        this.ensureWord();
        this.openBlock();
        break;

      case TokenType.OPEN_EXPRESSION:
        this.ensureWord();
        this.openExpression();
        break;

      case TokenType.COMMENT:
        if (this.withinSubstitution() && this.expectSource()) {
          throw new Error("unexpected comment delimiter");
        }
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
        this.beginSubstitution(token.literal);
        break;

      case TokenType.ASTERISK:
        this.ensureWord();
        this.addLiteral(token.literal);
        break;

      case TokenType.CLOSE_TUPLE:
        throw new Error("mismatched right parenthesis");

      case TokenType.CLOSE_BLOCK:
        throw new Error("mismatched right brace");

      case TokenType.CLOSE_EXPRESSION:
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
    this.context.morphemes = this.context.word.morphemes;
    return true;
  }
  private addLiteral(value: string) {
    // Attempt to merge consecutive, non substituted literals
    if (this.context.currentMorpheme()?.type == MorphemeType.LITERAL) {
      const morpheme = this.context.currentMorpheme() as LiteralMorpheme;
      if (!this.withinSubstitution()) {
        morpheme.value += value;
        return;
      }
    }
    const morpheme = new LiteralMorpheme();
    morpheme.value = value;
    this.context.morphemes.push(morpheme);
    this.continueSubstitution();
  }
  private closeWord() {
    this.endSubstitution();
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
    if (this.expectSource()) {
      switch (token.type) {
        case TokenType.TEXT:
        case TokenType.DOLLAR:
        case TokenType.OPEN_TUPLE:
        case TokenType.OPEN_BLOCK:
        case TokenType.OPEN_EXPRESSION:
          break;

        default:
          this.endSubstitution();
      }
    }
    switch (token.type) {
      case TokenType.DOLLAR:
        this.beginSubstitution(token.literal);
        break;

      case TokenType.STRING_DELIMITER:
        if (!this.closeString(token.literal)) {
          throw new Error("extra characters after string delimiter");
        }
        break;

      case TokenType.OPEN_TUPLE:
        if (this.withinSubstitution()) {
          this.openTuple();
        } else {
          this.addLiteral(token.literal);
        }
        break;

      case TokenType.OPEN_BLOCK:
        if (this.withinSubstitution()) {
          this.openBlock();
        } else {
          this.addLiteral(token.literal);
        }
        break;

      case TokenType.OPEN_EXPRESSION:
        this.openExpression();
        break;

      default:
        this.addLiteral(token.literal);
    }
  }
  private openString() {
    const morpheme = new StringMorpheme();
    this.context.word.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
      morphemes: morpheme.morphemes,
    });
  }
  private closeString(delimiter: string) {
    if (delimiter.length != 1) return false;
    this.endSubstitution();
    this.popContext();
    return true;
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
    const morpheme = new HereStringMorpheme(delimiter);
    this.context.word.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
  }
  private closeHereString(delimiter: string) {
    const parent = this.context.parent as HereStringMorpheme;
    if (delimiter.length != parent.delimiterLength) return false;
    this.popContext();
    return true;
  }
  private addHereStringSequence(value: string) {
    const parent = this.context.parent as HereStringMorpheme;
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
    const morpheme = new TaggedStringMorpheme(tag);
    this.context.word.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });

    // Discard everything until the next newline
    while (this.stream.next()?.type != TokenType.NEWLINE);
  }
  private closeTaggedString(literal: string) {
    const parent = this.context.parent as TaggedStringMorpheme;
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
    const parent = this.context.parent as TaggedStringMorpheme;
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
    const morpheme = new LineCommentMorpheme(delimiter);
    this.context.word.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
  }
  private closeLineComment() {
    this.popContext();
  }
  private addLineCommentSequence(value: string) {
    const parent = this.context.parent as LineCommentMorpheme;
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
      const parent = this.context.parent as BlockCommentMorpheme;
      if (parent.delimiterLength == delimiter.length) {
        parent.nesting++;
      }
      return false;
    }
    this.stream.next();
    const morpheme = new BlockCommentMorpheme(delimiter);
    this.context.word.morphemes.push(morpheme);
    this.pushContext(morpheme, {
      script: this.context.script,
      sentence: this.context.sentence,
      word: this.context.word,
    });
    return true;
  }
  private closeBlockComment() {
    const parent = this.context.parent as BlockCommentMorpheme;
    const token = this.stream.current();
    if (token?.type != TokenType.COMMENT) return false;
    if (token.literal.length != parent.delimiterLength) return false;
    if (--parent.nesting > 0) return false;
    this.stream.next();
    this.popContext();
    return true;
  }
  private addBlockCommentSequence(value: string) {
    const parent = this.context.parent as BlockCommentMorpheme;
    parent.value += value;
  }

  /*
   * Substitutions
   */

  private beginSubstitution(value: string) {
    if (this.context.currentMorpheme()?.type == MorphemeType.SUBSTITUTE_NEXT) {
      const morpheme = this.context.currentMorpheme() as SubstituteNextMorpheme;
      morpheme.value += value;
      morpheme.levels++;
      if (this.stream.current()?.type == TokenType.ASTERISK) {
        // Ignore expansion on inner substitutions
        morpheme.value += this.stream.next().literal;
      }
      return;
    }
    const morpheme = new SubstituteNextMorpheme();
    morpheme.value = value;
    if (this.stream.current()?.type == TokenType.ASTERISK) {
      morpheme.expansion = true;
      morpheme.value += this.stream.next().literal;
    }
    this.context.morphemes.push(morpheme);
    this.context.substitutionMode = "expect-source";
  }
  private continueSubstitution() {
    this.context.substitutionMode = this.expectSource()
      ? "expect-selector"
      : "";
  }
  private endSubstitution() {
    if (!this.expectSource()) return;

    // Convert stale substitutions to literals
    this.context.substitutionMode = "";
    const value = (this.context.currentMorpheme() as SubstituteNextMorpheme)
      .value;
    this.context.morphemes.pop();
    this.addLiteral(value);
  }
  private withinSubstitution() {
    return this.context.substitutionMode != "";
  }
  private expectSource() {
    return this.context.substitutionMode == "expect-source";
  }
  private expectSelector() {
    return this.context.substitutionMode == "expect-selector";
  }
}

/**
 * Array-based token stream
 */
class TokenStream {
  /** Source tokens */
  tokens: Token[];

  /** Current position in stream */
  index: number = 0;

  /**
   * Create a new stream from an array of tokens
   *
   * @param tokens Source array
   */
  constructor(tokens: Token[]) {
    this.tokens = tokens;
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
   * @param start First token index (inclusive)
   * @param end Last token index (exclusive)
   *
   * @returns Range of tokens
   */
  range(start: number, end: number) {
    return this.tokens.slice(start, end);
  }
}
