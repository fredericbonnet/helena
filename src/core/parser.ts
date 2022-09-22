/**
 * @file Helena parsing and AST generation
 */

import { Token, TokenType } from "./tokenizer";
import {
  Script,
  Sentence,
  Word,
  MorphemeType,
  Morpheme,
  LiteralMorpheme,
  TupleMorpheme,
  BlockMorpheme,
  ExpressionMorpheme,
  StringMorpheme,
  HereStringMorpheme,
  TaggedStringMorpheme,
  LineCommentMorpheme,
  BlockCommentMorpheme,
  SubstituteNextMorpheme,
} from "./syntax";

/**
 * Parsing context
 *
 * As the parser is non-recursive, it uses a context object to hold parsing
 * data along with the generated AST instead of relying on the call stack
 */
class Context {
  /** Node the context belongs to */
  readonly node: ContextualNode;

  /** Current script */
  readonly script: Script;

  /** Current sentence (if any) */
  sentence?: Sentence;

  /** Current word (if any) */
  word?: Word;

  /** Current morphemes (if any) */
  morphemes?: Morpheme[];

  /** 3-state mode during substitution */
  substitutionMode: "" | "expect-source" | "expect-selector";

  /**
   * @param ctx - Context to copy
   */
  constructor(ctx: Partial<Context>) {
    this.node = ctx.node;
    this.script = ctx.script;
    this.sentence = ctx.sentence;
    this.word = ctx.word;
    this.morphemes = ctx.morphemes;
  }

  /** @returns Current morpheme (if any) */
  currentMorpheme() {
    return this.morphemes?.[this.morphemes.length - 1];
  }
}

/** Morphemes with additional context for non-recursive parsing */
interface ContextualNode extends Morpheme {
  /** Parent parsing context */
  parentContext?: Context;
}

/* eslint-disable jsdoc/require-jsdoc */

/** Literal morpheme AST node */
class LiteralNode implements LiteralMorpheme {
  readonly type = MorphemeType.LITERAL;
  value: string;

  constructor(value: string) {
    this.value = value;
  }
}

/** Tuple morpheme AST node */
class TupleNode implements TupleMorpheme, ContextualNode {
  readonly type = MorphemeType.TUPLE;
  readonly subscript: Script = new Script();
  parentContext?: Context;
}

/** Block morpheme AST node */
class BlockNode implements BlockMorpheme, ContextualNode {
  readonly type = MorphemeType.BLOCK;
  readonly subscript: Script = new Script();
  value: string;
  parentContext?: Context;

  /** Starting position of block, used to get literal value */
  start: number;

  constructor(start: number) {
    this.start = start;
  }
}

/** Expression morpheme AST node */
class ExpressionNode implements ExpressionMorpheme, ContextualNode {
  readonly type = MorphemeType.EXPRESSION;
  readonly subscript: Script = new Script();
  parentContext?: Context;
}

/** String morpheme AST node */
class StringNode implements StringMorpheme, ContextualNode {
  readonly type = MorphemeType.STRING;
  readonly morphemes: Morpheme[] = [];
  parentContext?: Context;
}

/** Here-string morpheme AST node */
class HereStringNode implements HereStringMorpheme, ContextualNode {
  readonly type = MorphemeType.HERE_STRING;
  value = "";
  readonly delimiterLength: number;
  parentContext?: Context;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}

/** Tagged string morpheme AST node */
class TaggedStringNode implements TaggedStringMorpheme, ContextualNode {
  readonly type = MorphemeType.TAGGED_STRING;
  value = "";
  readonly tag: string;
  parentContext?: Context;

  constructor(tag: string) {
    this.tag = tag;
  }
}

/** Line comment morpheme AST node */
class LineCommentNode implements LineCommentMorpheme, ContextualNode {
  readonly type = MorphemeType.LINE_COMMENT;
  value = "";
  readonly delimiterLength: number;
  parentContext?: Context;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}

/** Block comment morpheme AST node */
class BlockCommentNode implements BlockCommentMorpheme, ContextualNode {
  readonly type = MorphemeType.BLOCK_COMMENT;
  value = "";
  readonly delimiterLength: number;
  parentContext?: Context;

  /** Nesting level, node is closed when it reaches zero */
  nesting = 1;

  constructor(delimiter: string) {
    this.delimiterLength = delimiter.length;
  }
}

/** Substitute Next morpheme AST node */
class SubstituteNextNode implements SubstituteNextMorpheme {
  readonly type = MorphemeType.SUBSTITUTE_NEXT;
  expansion = false;
  levels = 1;
  value: string;

  constructor(value: string) {
    this.value = value;
  }
}

/* eslint-enable jsdoc/require-jsdoc */

/**
 * Helena parser
 *
 * This class transforms a stream of tokens into an abstract syntax tree
 */
export class Parser {
  /** Input stream */
  private stream: TokenStream;

  /** Current context */
  private context: Context;

  /**
   * Parse an array of tokens
   *
   * @param tokens - Tokens to parse
   *
   * @returns        Parsed script
   */
  parse(tokens: Token[]) {
    this.stream = new TokenStream(tokens);
    this.context = new Context({
      script: new Script(),
    });

    while (!this.stream.end()) {
      const token = this.stream.next();
      switch (this.context.node?.type) {
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

    if (this.context.node) {
      switch (this.context.node.type) {
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

  /*
   * Context management
   */

  /**
   * Push a new context
   *
   * @param node - Contextual node
   * @param ctx  - New context data
   */
  private pushContext(node: ContextualNode, ctx: Partial<Context>) {
    node.parentContext = this.context;
    this.context = new Context({ ...ctx, node });
  }

  /**
   * Pop the existing context and return to its parent
   */
  private popContext() {
    const node = this.context.node;
    this.context = node.parentContext;
    node.parentContext = undefined;
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

  /** Open a tuple parsing context */
  private openTuple() {
    const node = new TupleNode();
    this.context.morphemes.push(node);
    this.pushContext(node, {
      script: node.subscript,
    });
  }

  /** Close the tuple parsing context */
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

  /** Open a block parsing context */
  private openBlock() {
    const node = new BlockNode(this.stream.index);
    this.context.morphemes.push(node);
    this.pushContext(node, {
      script: node.subscript,
    });
  }

  /** Close the block parsing context */
  private closeBlock() {
    const node = this.context.node as BlockNode;
    const range = this.stream.range(node.start, this.stream.index - 1);
    node.value = range.map((token) => token.literal).join("");
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

  /** Open an expression parsing context */
  private openExpression() {
    const node = new ExpressionNode();
    this.context.morphemes.push(node);
    this.pushContext(node, {
      script: node.subscript,
    });
  }

  /** Close the expression parsing context */
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
            this.closeString();
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

  /**
   * Ensure that word-related context info exists
   *
   * @returns False if the word context already exists, true if it has been created
   */
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

  /**
   * Attempt to merge consecutive, non substituted literals
   *
   * @param value - Literal to add or merge
   */
  private addLiteral(value: string) {
    if (this.context.currentMorpheme()?.type == MorphemeType.LITERAL) {
      const morpheme = this.context.currentMorpheme() as LiteralNode;
      if (!this.withinSubstitution()) {
        morpheme.value += value;
        return;
      }
    }
    const morpheme = new LiteralNode(value);
    this.context.morphemes.push(morpheme);
    this.continueSubstitution();
  }

  /** Close the current word */
  private closeWord() {
    this.endSubstitution();
    this.context.word = undefined;
  }

  /** Close the current sentence */
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
        if (token.literal.length != 1) {
          throw new Error("extra characters after string delimiter");
        }
        this.closeString();
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

  /** Open a string parsing context */
  private openString() {
    const node = new StringNode();
    this.context.morphemes.push(node);
    this.pushContext(node, {
      morphemes: node.morphemes,
    });
  }

  /** Close the string parsing context */
  private closeString() {
    this.endSubstitution();
    this.popContext();
  }

  /*
   * Here-strings
   */

  private parseHereString(token: Token) {
    switch (token.type) {
      case TokenType.STRING_DELIMITER:
        if (this.closeHereString(token.literal)) break;
      /* continued */
      // eslint-disable-next-line no-fallthrough
      default:
        this.addHereStringSequence(token.sequence);
    }
  }

  /**
   * Open a here-string parsing context
   *
   * @param delimiter - Open delimiter sequence
   */
  private openHereString(delimiter: string) {
    const node = new HereStringNode(delimiter);
    this.context.morphemes.push(node);
    this.pushContext(node, {});
  }
  /**
   * Attempt to close the here-string parsing context
   *
   * @param delimiter - Close delimiter sequence, must match open delimiters
   *
   * @returns           Whether the context was closed
   */
  private closeHereString(delimiter: string) {
    const node = this.context.node as HereStringNode;
    if (delimiter.length != node.delimiterLength) return false;
    this.popContext();
    return true;
  }

  /**
   * Append sequence to current here-string
   *
   * @param value - Value to append
   */
  private addHereStringSequence(value: string) {
    const node = this.context.node as HereStringNode;
    node.value += value;
  }

  /*
   * Tagged strings
   */

  private parseTaggedString(token: Token) {
    switch (token.type) {
      case TokenType.TEXT:
        if (this.closeTaggedString(token.literal)) break;
      /* continued */
      // eslint-disable-next-line no-fallthrough
      default:
        this.addTaggedStringSequence(token.sequence);
    }
  }

  /**
   * Open a tagged string parsing context
   *
   * @param tag - String tag
   */
  private openTaggedString(tag: string) {
    const node = new TaggedStringNode(tag);
    this.context.morphemes.push(node);
    this.pushContext(node, {});

    // Discard everything until the next newline
    while (this.stream.next()?.type != TokenType.NEWLINE);
  }

  /**
   * Attempt to close the tagged string parsing context
   *
   * @param literal - Close tag, must match open tag
   *
   * @returns         Whether the context was closed
   */
  private closeTaggedString(literal: string) {
    const node = this.context.node as TaggedStringNode;
    if (literal != node.tag) return false;
    const next = this.stream.current();
    if (next?.type != TokenType.STRING_DELIMITER) return false;
    if (next.literal.length != 2) return false;
    this.stream.next();

    // Shift lines by prefix length
    const lines = node.value.split("\n");
    const prefix = lines[lines.length - 1];
    node.value = lines.map((line) => line.substring(prefix.length)).join("\n");

    this.popContext();
    return true;
  }

  /**
   * Append sequence to current tagged string
   *
   * @param value - Value to append
   */
  private addTaggedStringSequence(value: string) {
    const node = this.context.node as TaggedStringNode;
    node.value += value;
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

  /**
   * Open a line comment parsing context
   *
   * @param delimiter - Line comment delimiter
   */
  private openLineComment(delimiter: string) {
    const node = new LineCommentNode(delimiter);
    this.context.morphemes.push(node);
    this.pushContext(node, {});
  }

  /** Close the line comment parsing context */
  private closeLineComment() {
    this.popContext();
  }

  /**
   * Append sequence to current line comment
   *
   * @param value - Value to append
   */
  private addLineCommentSequence(value: string) {
    const node = this.context.node as LineCommentNode;
    node.value += value;
  }

  /*
   * Block comments
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

  /**
   * Attempt to open a block comment parsing context
   *
   * @param delimiter - Block comment delimiter
   * @param [nested]  - Whether in block comment context
   *
   * @returns           Whether the context was open
   */
  private openBlockComment(delimiter: string, nested = false) {
    if (this.stream.current()?.type != TokenType.OPEN_BLOCK) return false;
    if (nested) {
      const node = this.context.node as BlockCommentNode;
      if (node.delimiterLength == delimiter.length) {
        node.nesting++;
      }
      return false;
    }
    this.stream.next();
    const node = new BlockCommentNode(delimiter);
    this.context.morphemes.push(node);
    this.pushContext(node, {});
    return true;
  }

  /**
   * Attempt to close the block comment parsing context
   *
   * @returns Whether the context was closed
   */
  private closeBlockComment() {
    const node = this.context.node as BlockCommentNode;
    const token = this.stream.current();
    if (token?.type != TokenType.COMMENT) return false;
    if (token.literal.length != node.delimiterLength) return false;
    if (--node.nesting > 0) return false;
    this.stream.next();
    this.popContext();
    return true;
  }

  /**
   * Append sequence to current block comment
   *
   * @param value - Value to append
   */
  private addBlockCommentSequence(value: string) {
    const node = this.context.node as BlockCommentNode;
    node.value += value;
  }

  /*
   * Substitutions
   */

  private beginSubstitution(value: string) {
    if (this.context.currentMorpheme()?.type == MorphemeType.SUBSTITUTE_NEXT) {
      const morpheme = this.context.currentMorpheme() as SubstituteNextNode;
      morpheme.value += value;
      morpheme.levels++;
      if (this.stream.current()?.type == TokenType.ASTERISK) {
        // Ignore expansion on inner substitutions
        morpheme.value += this.stream.next().literal;
      }
      return;
    }
    const morpheme = new SubstituteNextNode(value);
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
    const value = (this.context.currentMorpheme() as SubstituteNextNode).value;
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
}