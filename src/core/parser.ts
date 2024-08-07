/**
 * @file Helena parsing and AST generation
 */

import { ArrayTokenStream, Token, TokenStream, TokenType } from "./tokenizer";
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
import { Source } from "./source";

/**
 * Parsing context
 *
 * As the parser is non-recursive, it uses a context object to hold parsing
 * data along with the generated AST instead of relying on the call stack
 */
class Context {
  /** Parent parsing context */
  readonly parentContext?: Context;

  /** Morpheme the context belongs to */
  readonly node?: MorphemeNode;

  /** Current script */
  readonly script?: ScriptNode;

  /** Current sentence (if any) */
  sentence?: SentenceNode;

  /** Current word (if any) */
  word?: WordNode;

  /** Current morphemes (if any) */
  morphemes?: MorphemeNode[];

  /** 3-state mode during substitution */
  substitutionMode: "" | "expect-source" | "expect-selector";

  /**
   * @param ctx - Context to copy
   */
  constructor(ctx: Partial<Context>) {
    this.parentContext = ctx.parentContext;
    this.node = ctx.node;
    this.script = ctx.script;
    this.sentence = ctx.sentence;
    this.word = ctx.word;
    this.morphemes = ctx.morphemes;
    this.substitutionMode = "";
  }

  /** @returns Current morpheme (if any) */
  currentMorpheme() {
    return this.morphemes?.[this.morphemes.length - 1];
  }
}

/* eslint-disable jsdoc/require-jsdoc */

/** Script AST node */
class ScriptNode {
  sentences: SentenceNode[];
  firstToken: Token;

  constructor(firstToken: Token) {
    this.sentences = [];
    this.firstToken = firstToken;
  }

  toScript(capturePositions: boolean, source: Source | undefined): Script {
    const script = new Script(
      capturePositions ? source : undefined,
      capturePositions ? this.firstToken.position : undefined
    );
    for (const sentence of this.sentences) {
      script.sentences.push(sentence.toSentence(capturePositions, source));
    }
    return script;
  }
}

/** Sentence AST node */
class SentenceNode {
  words: WordNode[];
  firstToken: Token;

  constructor(firstToken: Token) {
    this.words = [];
    this.firstToken = firstToken;
  }

  toSentence(capturePositions: boolean, source: Source | undefined): Sentence {
    const sentence = new Sentence(
      capturePositions ? this.firstToken.position : undefined
    );
    for (const word of this.words) {
      sentence.words.push(word.toWord(capturePositions, source));
    }
    return sentence;
  }
}

/** Word AST node */
class WordNode {
  /** Word morphemes */
  morphemes: MorphemeNode[];
  firstToken: Token;

  constructor(firstToken: Token) {
    this.morphemes = [];
    this.firstToken = firstToken;
  }

  toWord(capturePositions: boolean, source: Source | undefined): Word {
    const word = new Word(
      capturePositions ? this.firstToken.position : undefined
    );
    for (const morpheme of this.morphemes) {
      word.morphemes.push(morpheme.toMorpheme(capturePositions, source));
    }
    return word;
  }
}

/** Morpheme AST node */
interface MorphemeNode {
  /** Type identifier */
  type: MorphemeType;

  /** First token in morpheme */
  firstToken: Token;

  /** Create morpheme from node */
  toMorpheme(capturePositions: boolean, source: Source | undefined): Morpheme;
}

/** Literal morpheme AST node */
class LiteralNode implements MorphemeNode {
  readonly type = MorphemeType.LITERAL;
  readonly firstToken: Token;
  value: string;

  constructor(firstToken: Token, value: string) {
    this.firstToken = firstToken;
    this.value = value;
  }

  toMorpheme(capturePositions: boolean, _source?: Source): LiteralMorpheme {
    return {
      type: this.type,
      value: this.value,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Tuple morpheme AST node */
class TupleNode implements MorphemeNode {
  readonly type = MorphemeType.TUPLE;
  readonly firstToken: Token;
  readonly subscript: ScriptNode;

  constructor(firstToken: Token) {
    this.firstToken = firstToken;
    this.subscript = new ScriptNode(firstToken);
  }

  toMorpheme(
    capturePositions: boolean,
    source: Source | undefined
  ): TupleMorpheme {
    return {
      type: this.type,
      subscript: this.subscript.toScript(capturePositions, source),
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Block morpheme AST node */
class BlockNode implements MorphemeNode {
  readonly type = MorphemeType.BLOCK;
  readonly firstToken: Token;
  readonly subscript: ScriptNode;
  value: string;

  /** Starting position of block, used to get literal value */
  start: number;

  constructor(firstToken: Token, start: number) {
    this.firstToken = firstToken;
    this.subscript = new ScriptNode(firstToken);
    this.start = start;
  }

  toMorpheme(
    capturePositions: boolean,
    source: Source | undefined
  ): BlockMorpheme {
    return {
      type: this.type,
      subscript: this.subscript.toScript(capturePositions, source),
      value: this.value,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Expression morpheme AST node */
class ExpressionNode implements MorphemeNode {
  readonly type = MorphemeType.EXPRESSION;
  readonly firstToken: Token;
  readonly subscript: ScriptNode;

  constructor(firstToken: Token) {
    this.firstToken = firstToken;
    this.subscript = new ScriptNode(firstToken);
  }

  toMorpheme(
    capturePositions: boolean,
    source: Source | undefined
  ): ExpressionMorpheme {
    return {
      type: this.type,
      subscript: this.subscript.toScript(capturePositions, source),
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** String morpheme AST node */
class StringNode implements MorphemeNode {
  readonly type = MorphemeType.STRING;
  readonly firstToken: Token;
  readonly morphemes: MorphemeNode[];

  constructor(firstToken: Token) {
    this.firstToken = firstToken;
    this.morphemes = [];
  }

  toMorpheme(
    capturePositions: boolean,
    source: Source | undefined
  ): StringMorpheme {
    return {
      type: this.type,
      morphemes: this.morphemes.map((morpheme) =>
        morpheme.toMorpheme(capturePositions, source)
      ),
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Here-string morpheme AST node */
class HereStringNode implements MorphemeNode {
  readonly type = MorphemeType.HERE_STRING;
  readonly firstToken: Token;
  value: string;
  readonly delimiterLength: number;

  constructor(firstToken: Token, delimiter: string) {
    this.firstToken = firstToken;
    this.value = "";
    this.delimiterLength = delimiter.length;
  }

  toMorpheme(capturePositions: boolean): HereStringMorpheme {
    return {
      type: this.type,
      value: this.value,
      delimiterLength: this.delimiterLength,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Tagged string morpheme AST node */
class TaggedStringNode implements MorphemeNode {
  readonly type = MorphemeType.TAGGED_STRING;
  readonly firstToken: Token;
  value: string;
  readonly tag: string;

  constructor(firstToken: Token, tag: string) {
    this.firstToken = firstToken;
    this.value = "";
    this.tag = tag;
  }

  toMorpheme(capturePositions: boolean): TaggedStringMorpheme {
    // Shift lines by prefix length
    const lines = this.value.split("\n");
    const prefix = lines[lines.length - 1];
    const value = lines.map((line) => line.substring(prefix.length)).join("\n");

    return {
      type: this.type,
      value: value,
      tag: this.tag,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Line comment morpheme AST node */
class LineCommentNode implements MorphemeNode {
  readonly type = MorphemeType.LINE_COMMENT;
  readonly firstToken: Token;
  value: string;
  readonly delimiterLength: number;

  constructor(firstToken: Token, delimiter: string) {
    this.firstToken = firstToken;
    this.value = "";
    this.delimiterLength = delimiter.length;
  }

  toMorpheme(capturePositions: boolean): LineCommentMorpheme {
    return {
      type: this.type,
      value: this.value,
      delimiterLength: this.delimiterLength,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Block comment morpheme AST node */
class BlockCommentNode implements MorphemeNode {
  readonly type = MorphemeType.BLOCK_COMMENT;
  readonly firstToken: Token;
  value: string;
  readonly delimiterLength: number;

  /** Nesting level, node is closed when it reaches zero */
  nesting = 1;

  constructor(firstToken: Token, delimiter: string) {
    this.firstToken = firstToken;
    this.value = "";
    this.delimiterLength = delimiter.length;
  }

  toMorpheme(capturePositions: boolean): BlockCommentMorpheme {
    return {
      type: this.type,
      value: this.value,
      delimiterLength: this.delimiterLength,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/** Substitute Next morpheme AST node */
class SubstituteNextNode implements MorphemeNode {
  readonly type = MorphemeType.SUBSTITUTE_NEXT;
  readonly firstToken: Token;
  expansion: boolean;
  value: string;

  constructor(firstToken: Token, value: string) {
    this.firstToken = firstToken;
    this.expansion = false;
    this.value = value;
  }

  toMorpheme(capturePositions: boolean): SubstituteNextMorpheme {
    return {
      type: this.type,
      expansion: this.expansion,
      value: this.value,
      position: capturePositions ? this.firstToken.position : undefined,
    };
  }
}

/* eslint-enable jsdoc/require-jsdoc */

/** Parse result */
export type ParseResult = {
  /** Success flag */
  success: boolean;

  /** Parsed script on success */
  script?: Script;

  /** Error message */
  message?: string;
};

/* Helpers */
/* eslint-disable jsdoc/require-jsdoc */
export const PARSE_OK = (script?: Script) => ({ success: true, script });
export const PARSE_ERROR = (message: string) => ({ success: false, message });
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Parser options
 */
export type ParserOptions = {
  /** Whether to capture morpheme positions */
  capturePositions?: boolean;
};

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

  /** Parser options */
  private options: ParserOptions;

  /* eslint-disable jsdoc/require-jsdoc */
  constructor(options: ParserOptions = { capturePositions: false }) {
    this.options = options;
  }
  /* eslint-enable jsdoc/require-jsdoc */

  /**
   * Parse a token stream till the end
   *
   * @param stream - Stream to parse
   *
   * @returns        Script result on success, else error
   */
  parse(stream: TokenStream): ParseResult {
    const result = this.parseStream(stream);
    if (!result.success) return result;
    return this.closeStream();
  }

  /**
   * Parse an array of tokens
   *
   * @param tokens   - Tokens to parse
   * @param [source] - Stream source
   *
   * @returns          Script result on success, else error
   */
  parseTokens(tokens: Token[], source?: Source): ParseResult {
    return this.parse(new ArrayTokenStream(tokens, source));
  }

  /**
   * Parse a token stream
   *
   * This method is useful when parsing incomplete scripts in interactive mode,
   * as getting an error at this stage is unrecoverable even if there is more
   * input to parse
   *
   * @param stream - Stream to parse
   *
   * @returns        Empty result on success, else error
   */
  parseStream(stream: TokenStream): ParseResult {
    this.begin(stream);
    while (!this.end()) {
      const result = this.next();
      if (!result.success) return result;
    }
    return PARSE_OK();
  }

  /**
   * Start incremental parsing of a Helena token stream
   *
   * @param stream - Stream to parse
   */
  begin(stream: TokenStream) {
    this.context = new Context({
      script: new ScriptNode(stream.current()),
    });
    this.stream = stream;
  }

  /**
   * Check end of incremental parsing
   *
   * @returns Whether parsing is done
   */
  end(): boolean {
    return this.stream.end();
  }

  /**
   * Parse current token and advance to next one
   *
   * @returns Result
   */
  next(): ParseResult {
    const token = this.stream.next();
    return this.parseToken(token);
  }

  /**
   * Close the current token stream
   *
   * This method is useful when testing for script completeness in interactive
   * mode and prompt for more input
   *
   * @returns Script result on success, else error
   */
  closeStream(): ParseResult {
    if (this.context.node) {
      switch (this.context.node.type) {
        case MorphemeType.TUPLE:
          return PARSE_ERROR("unmatched left parenthesis");
        case MorphemeType.BLOCK:
          return PARSE_ERROR("unmatched left brace");
        case MorphemeType.EXPRESSION:
          return PARSE_ERROR("unmatched left bracket");
        case MorphemeType.STRING:
          return PARSE_ERROR("unmatched string delimiter");
        case MorphemeType.HERE_STRING:
          return PARSE_ERROR("unmatched here-string delimiter");
        case MorphemeType.TAGGED_STRING:
          return PARSE_ERROR("unmatched tagged string delimiter");
        case MorphemeType.LINE_COMMENT:
          this.closeLineComment();
          break;
        case MorphemeType.BLOCK_COMMENT:
          return PARSE_ERROR("unmatched block comment delimiter");
        default:
          return PARSE_ERROR("unterminated script");
      }
    }
    this.closeSentence();

    return PARSE_OK(
      this.context.script.toScript(
        this.options.capturePositions,
        this.stream.source
      )
    );
  }

  /**
   * Parse a single token
   *
   * @param token - Token to parse
   *
   * @returns       Result
   */
  private parseToken(token: Token): ParseResult {
    switch (this.context.node?.type) {
      case MorphemeType.TUPLE:
        return this.parseTuple(token);

      case MorphemeType.BLOCK:
        return this.parseBlock(token);

      case MorphemeType.EXPRESSION:
        return this.parseExpression(token);

      case MorphemeType.STRING:
        return this.parseString(token);

      case MorphemeType.HERE_STRING:
        return this.parseHereString(token);

      case MorphemeType.TAGGED_STRING:
        return this.parseTaggedString(token);

      case MorphemeType.LINE_COMMENT:
        return this.parseLineComment(token);

      case MorphemeType.BLOCK_COMMENT:
        return this.parseBlockComment(token);

      default:
        return this.parseScript(token);
    }
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
  private pushContext(node: MorphemeNode, ctx: Partial<Context>) {
    this.context = new Context({ ...ctx, node, parentContext: this.context });
  }

  /**
   * Pop the existing context and return to its parent
   */
  private popContext() {
    this.context = this.context.parentContext;
  }

  /*
   * Scripts
   */

  private parseScript(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.CLOSE_TUPLE:
        return PARSE_ERROR("unmatched right parenthesis");

      case TokenType.CLOSE_BLOCK:
        return PARSE_ERROR("unmatched right brace");

      case TokenType.CLOSE_EXPRESSION:
        return PARSE_ERROR("unmatched right bracket");

      default:
        return this.parseWord(token);
    }
  }

  /*
   * Tuples
   */

  private parseTuple(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.CLOSE_TUPLE:
        this.closeTuple();
        if (this.expectSource()) this.continueSubstitution();
        return PARSE_OK();

      default:
        return this.parseWord(token);
    }
  }

  /**
   * Open a tuple parsing context
   *
   * @param token - Current token
   */
  private openTuple(token: Token) {
    const node = new TupleNode(token);
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

  private parseBlock(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.CLOSE_BLOCK:
        this.closeBlock();
        if (this.expectSource()) this.continueSubstitution();
        return PARSE_OK();

      default:
        return this.parseWord(token);
    }
  }

  /**
   * Open a block parsing context
   *
   * @param token - Current token
   */
  private openBlock(token: Token) {
    const node = new BlockNode(token, this.stream.currentIndex());
    this.context.morphemes.push(node);
    this.pushContext(node, {
      script: node.subscript,
    });
  }

  /** Close the block parsing context */
  private closeBlock() {
    const node = this.context.node as BlockNode;
    const range = this.stream.range(node.start, this.stream.currentIndex() - 1);
    node.value = range.map((token) => token.literal).join("");
    this.popContext();
  }

  /*
   * Expressions
   */

  private parseExpression(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.CLOSE_EXPRESSION:
        this.closeExpression();
        this.continueSubstitution();
        return PARSE_OK();

      default:
        return this.parseWord(token);
    }
  }

  /**
   * Open an expression parsing context
   *
   * @param token - Current token
   */
  private openExpression(token: Token) {
    const node = new ExpressionNode(token);
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

  private parseWord(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.WHITESPACE:
      case TokenType.CONTINUATION:
        this.closeWord();
        return PARSE_OK();

      case TokenType.NEWLINE:
      case TokenType.SEMICOLON:
        this.closeSentence();
        return PARSE_OK();

      case TokenType.TEXT:
      case TokenType.ESCAPE:
        this.ensureWord(token);
        this.addLiteral(token, token.literal);
        return PARSE_OK();

      case TokenType.STRING_DELIMITER:
        if (!this.ensureWord(token)) {
          return PARSE_ERROR("unexpected string delimiter");
        }
        if (token.literal.length == 1) {
          // Regular strings
          this.openString(token);
        } else if (token.literal.length == 2) {
          const next = this.stream.current();
          if (next?.type == TokenType.TEXT) {
            // Tagged strings
            this.openTaggedString(token, next.literal);
          } else {
            // Special case for empty strings
            this.openString(token);
            this.closeString();
          }
        } else {
          // Here-strings
          this.openHereString(token, token.literal);
        }
        return PARSE_OK();

      case TokenType.OPEN_TUPLE:
        this.ensureWord(token);
        this.openTuple(token);
        return PARSE_OK();

      case TokenType.OPEN_BLOCK:
        this.ensureWord(token);
        this.openBlock(token);
        return PARSE_OK();

      case TokenType.OPEN_EXPRESSION:
        this.ensureWord(token);
        this.openExpression(token);
        return PARSE_OK();

      case TokenType.COMMENT:
        if (this.expectSource()) {
          return PARSE_ERROR("unexpected comment delimiter");
        }
        if (!this.ensureWord(token)) {
          this.addLiteral(token, token.literal);
          return PARSE_OK();
        }
        if (!this.openBlockComment(token, token.literal)) {
          this.openLineComment(token, token.literal);
        }
        return PARSE_OK();

      case TokenType.DOLLAR:
        this.ensureWord(token);
        this.beginSubstitution(token, token.literal);
        return PARSE_OK();

      case TokenType.ASTERISK:
        this.ensureWord(token);
        this.addLiteral(token, token.literal);
        return PARSE_OK();

      case TokenType.CLOSE_TUPLE:
        return PARSE_ERROR("mismatched right parenthesis");

      case TokenType.CLOSE_BLOCK:
        return PARSE_ERROR("mismatched right brace");

      case TokenType.CLOSE_EXPRESSION:
        return PARSE_ERROR("mismatched right bracket");

      default:
        return PARSE_ERROR("syntax error");
    }
  }

  /**
   * Ensure that word-related context info exists
   *
   * @param token - Current token
   *
   * @returns       False if the word context already exists, true if it has been created
   */
  private ensureWord(token) {
    if (this.context.word) return false;
    if (!this.context.sentence) {
      this.context.sentence = new SentenceNode(token);
      this.context.script.sentences.push(this.context.sentence);
    }
    this.context.word = new WordNode(token);
    this.context.sentence.words.push(this.context.word);
    this.context.morphemes = this.context.word.morphemes;
    return true;
  }

  /**
   * Attempt to merge consecutive, non substituted literals
   *
   * @param token - Current token
   * @param value - Literal to add or merge
   */
  private addLiteral(token: Token, value: string) {
    if (
      this.context.currentMorpheme()?.type == MorphemeType.LITERAL &&
      !this.withinSubstitution()
    ) {
      const morpheme = this.context.currentMorpheme() as LiteralNode;
      morpheme.value += value;
      return;
    }
    const morpheme = new LiteralNode(token, value);
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

  private parseString(token: Token): ParseResult {
    if (this.expectSource()) {
      switch (token.type) {
        case TokenType.TEXT:
        case TokenType.DOLLAR:
        case TokenType.OPEN_BLOCK:
        case TokenType.OPEN_EXPRESSION:
          break;

        default:
          this.endSubstitution();
      }
    }
    switch (token.type) {
      case TokenType.DOLLAR:
        this.beginSubstitution(token, token.literal);
        break;

      case TokenType.STRING_DELIMITER:
        if (token.literal.length != 1) {
          return PARSE_ERROR("extra characters after string delimiter");
        }
        this.closeString();
        break;

      case TokenType.OPEN_TUPLE:
        if (this.withinSubstitution()) {
          this.openTuple(token);
        } else {
          this.addLiteral(token, token.literal);
        }
        break;

      case TokenType.OPEN_BLOCK:
        if (this.withinSubstitution()) {
          this.openBlock(token);
        } else {
          this.addLiteral(token, token.literal);
        }
        break;

      case TokenType.OPEN_EXPRESSION:
        this.openExpression(token);
        break;

      default:
        this.addLiteral(token, token.literal);
    }
    return PARSE_OK();
  }

  /**
   * Open a string parsing context
   *
   * @param token - Current token
   */
  private openString(token: Token) {
    const node = new StringNode(token);
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

  private parseHereString(token: Token): ParseResult {
    if (
      token.type == TokenType.STRING_DELIMITER &&
      this.closeHereString(token.literal)
    )
      return PARSE_OK();
    this.addHereStringSequence(token.sequence);
    return PARSE_OK();
  }

  /**
   * Open a here-string parsing context
   *
   * @param token     - Current token
   * @param delimiter - Open delimiter sequence
   */
  private openHereString(token: Token, delimiter: string) {
    const node = new HereStringNode(token, delimiter);
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
    if (token.type == TokenType.TEXT && this.closeTaggedString(token.literal))
      return PARSE_OK();
    this.addTaggedStringSequence(token.sequence);
    return PARSE_OK();
  }

  /**
   * Open a tagged string parsing context
   *
   * @param token - Current token
   * @param tag   - String tag
   */
  private openTaggedString(token: Token, tag: string) {
    const node = new TaggedStringNode(token, tag);
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

  private parseLineComment(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.NEWLINE:
        this.closeLineComment();
        this.closeSentence();
        break;

      default:
        this.addLineCommentSequence(token.literal);
    }
    return PARSE_OK();
  }

  /**
   * Open a line comment parsing context
   *
   * @param token     - Current token
   * @param delimiter - Line comment delimiter
   */
  private openLineComment(token: Token, delimiter: string) {
    const node = new LineCommentNode(token, delimiter);
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

  private parseBlockComment(token: Token): ParseResult {
    switch (token.type) {
      case TokenType.COMMENT:
        if (!this.openBlockComment(token, token.literal, true)) {
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
    return PARSE_OK();
  }

  /**
   * Attempt to open a block comment parsing context
   *
   * @param token     - Current token
   * @param delimiter - Block comment delimiter
   * @param [nested]  - Whether in block comment context
   *
   * @returns           Whether the context was open
   */
  private openBlockComment(token: Token, delimiter: string, nested = false) {
    if (this.stream.current()?.type != TokenType.OPEN_BLOCK) return false;
    if (nested) {
      const node = this.context.node as BlockCommentNode;
      if (node.delimiterLength == delimiter.length) {
        node.nesting++;
      }
      return false;
    }
    this.stream.next();
    const node = new BlockCommentNode(token, delimiter);
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

  private beginSubstitution(token: Token, value: string) {
    const morpheme = new SubstituteNextNode(token, value);
    if (this.stream.current()?.type == TokenType.ASTERISK) {
      if (
        this.context.currentMorpheme()?.type != MorphemeType.SUBSTITUTE_NEXT
      ) {
        // Only expand the leading substitution
        morpheme.expansion = true;
      }
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
    let firstToken: Token;
    let value = "";
    while (
      this.context.currentMorpheme()?.type == MorphemeType.SUBSTITUTE_NEXT
    ) {
      const current = this.context.currentMorpheme() as SubstituteNextNode;
      firstToken = current.firstToken;
      value = current.value + value;
      this.context.morphemes.pop();
    }
    this.addLiteral(firstToken, value);
  }
  private withinSubstitution() {
    return this.context.substitutionMode != "";
  }
  private expectSource() {
    return this.context.substitutionMode == "expect-source";
  }
}
