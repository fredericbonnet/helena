/**
 * @file Helena syntax checking and AST
 */

import { Value } from "./values";

/**
 * Helena script
 *
 * Scripts are lists of sentences
 */
export class Script {
  /** Sentences that compose the script */
  readonly sentences: Sentence[] = [];
}

/**
 * Helena sentence
 *
 * Sentences are lists of words or values
 */
export class Sentence {
  /** Words that compose the sentence */
  readonly words: (Word | Value)[] = [];
}

/**
 * Helena word
 *
 * Words are made of morphemes
 */
export class Word {
  /** Morphemes that compose the word */
  readonly morphemes: Morpheme[] = [];
}

/**
 * Helena morpheme type
 */
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

/**
 * Helena morpheme
 *
 * Morphemes are the basic constituents of words
 */
export interface Morpheme {
  /** Type identifier */
  readonly type: MorphemeType;
}

/**
 * Literal morpheme
 *
 * Literals are plain strings
 */
export interface LiteralMorpheme extends Morpheme {
  /** Literal string value */
  readonly value: string;
}

/**
 * Tuple morpheme
 *
 * Tuples are scripts between tuple delimiters
 */
export interface TupleMorpheme extends Morpheme {
  /** Tuple script content */
  readonly subscript: Script;
}

/**
 * Block morpheme
 *
 * Blocks are scripts or strings between block delimiters
 */
export interface BlockMorpheme extends Morpheme {
  /** Block script content */
  readonly subscript: Script;

  /** Block string value */
  readonly value: string;
}

/**
 * Expression morpheme
 *
 * Expressions are scripts between expression delimiters
 */
export interface ExpressionMorpheme extends Morpheme {
  /** Expression script content */
  readonly subscript: Script;
}

/**
 * String morpheme
 *
 * Strings are made of morphemes between single string delimiters
 */
export interface StringMorpheme extends Morpheme {
  /** String content */
  readonly morphemes: Morpheme[];
}

/**
 * Here-string morpheme
 *
 * Here-strings are plain strings between three or more string delimiters
 */
export interface HereStringMorpheme extends Morpheme {
  /** Here-string value */
  readonly value: string;

  /** Number of string delimiters around content */
  readonly delimiterLength: number;
}

/**
 * Tagged string morpheme
 *
 * Tagged strings are plain strings between two string delimiters and an
 * arbitrary tag
 */
export interface TaggedStringMorpheme extends Morpheme {
  /** Tagged string value */
  readonly value: string;

  /** Tag */
  readonly tag: string;
}

/**
 * Line comment morpheme
 */
export interface LineCommentMorpheme extends Morpheme {
  /** Line comment content */
  readonly value: string;

  /** Number of comment characters before content  */
  readonly delimiterLength: number;
}

/**
 * Block comment morpheme
 */
export interface BlockCommentMorpheme extends Morpheme {
  /** Block comment content */
  readonly value: string;

  /** Number of comment characters around content  */
  readonly delimiterLength: number;
}

/**
 * Substitute Next morpheme
 *
 * Always followed by a sequence of morphemes to substitute; stale substitutions
 * (substitution characters with no such sequence) are always converted to
 * {@link LiteralMorpheme} and should not appear in a well-formed AST
 */
export interface SubstituteNextMorpheme extends Morpheme {
  /** Simple or expanded substitution flag */
  readonly expansion: boolean;

  /** Number of substitutions to perform */
  readonly levels: number;

  /** Literal value; can be safely ignored */
  readonly value: string;
}

/**
 * Helena word type
 *
 * Valid word types must respect strict syntactic rules
 */
export enum WordType {
  /** Roots are monomorphemic words */
  ROOT,

  /** Compounds are words made of several stems, that don't fit in the other categories */
  COMPOUND,

  /** Substitions are root or qualified words prefixed by a substitute morpheme */
  SUBSTITUTION,

  /** Qualified words are root words followed by selectors */
  QUALIFIED,

  /** Ignored words are line and block comments */
  IGNORED,

  /** Invalid word structure */
  INVALID,
}

/**
 * Helena syntax checker
 *
 * This class validates syntactic rules on words and determines their type
 */
export class SyntaxChecker {
  /**
   * Check word syntax and determine its type
   *
   * @param word - Word to check
   *
   * @returns      Checked word type
   */
  checkWord(word: Word): WordType {
    if (word.morphemes.length == 0) return WordType.INVALID;
    switch (word.morphemes[0].type) {
      case MorphemeType.LITERAL: {
        const type = this.checkQualifiedWord(word);
        return type == WordType.INVALID ? this.checkCompoundWord(word) : type;
      }
      case MorphemeType.EXPRESSION:
        return this.checkCompoundWord(word);
      case MorphemeType.TUPLE:
      case MorphemeType.BLOCK:
        return this.checkQualifiedWord(word);
      case MorphemeType.STRING:
      case MorphemeType.HERE_STRING:
      case MorphemeType.TAGGED_STRING:
        return this.checkRootWord(word);
      case MorphemeType.LINE_COMMENT:
      case MorphemeType.BLOCK_COMMENT:
        return this.checkIgnoredWord(word);
      case MorphemeType.SUBSTITUTE_NEXT:
        return this.checkSubstitutionWord(word);
    }
  }

  private checkRootWord(word: Word): WordType {
    if (word.morphemes.length != 1) return WordType.INVALID;
    return WordType.ROOT;
  }

  private checkCompoundWord(word: Word): WordType {
    /* Lone morphemes are roots */
    if (word.morphemes.length == 1) return WordType.ROOT;

    if (this.checkStems(word.morphemes) < 0) return WordType.INVALID;
    return WordType.COMPOUND;
  }

  private checkQualifiedWord(word: Word): WordType {
    /* Lone morphemes are roots */
    if (word.morphemes.length == 1) return WordType.ROOT;

    const selectors = this.skipSelectors(word.morphemes, 1);
    if (selectors != word.morphemes.length) return WordType.INVALID;
    return WordType.QUALIFIED;
  }

  private checkSubstitutionWord(word: Word): WordType {
    if (word.morphemes.length < 2) return WordType.INVALID;
    const nbStems = this.checkStems(word.morphemes);
    return nbStems < 0
      ? WordType.INVALID
      : nbStems > 1
      ? WordType.COMPOUND
      : WordType.SUBSTITUTION;
  }

  private checkIgnoredWord(word: Word): WordType {
    if (word.morphemes.length != 1) return WordType.INVALID;
    return WordType.IGNORED;
  }

  /**
   * Check stem sequence in a compound or substitution word
   *
   * @param morphemes - Morphemes to check
   *
   * @returns           Number of stems, or < 0 if error
   */
  private checkStems(morphemes: Morpheme[]): number {
    let nbStems = 0;
    let substitute = false;
    let hasTuples = false;
    for (let i = 0; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      if (substitute) {
        /* Expect valid root followed by selectors */
        switch (morpheme.type) {
          case MorphemeType.TUPLE:
            hasTuples = true;
          /* continued */
          // eslint-disable-next-line no-fallthrough
          case MorphemeType.LITERAL:
          case MorphemeType.BLOCK:
          case MorphemeType.EXPRESSION:
            i = this.skipSelectors(morphemes, i + 1) - 1;
            substitute = false;
            break;

          default:
            return -1;
        }
      } else {
        switch (morpheme.type) {
          case MorphemeType.SUBSTITUTE_NEXT:
            nbStems++;
            substitute = true;
            break;

          case MorphemeType.LITERAL:
          case MorphemeType.EXPRESSION:
            nbStems++;
            substitute = false;
            break;

          default:
            return -1;
        }
      }
    }
    /* Tuples are invalid in compound words */
    if (hasTuples && nbStems > 1) return -1;

    return nbStems;
  }

  /**
   * Skip all the selectors following a stem root
   *
   * @param morphemes - Morphemes to check
   * @param first     - Index of first expected selector
   *
   * @returns           Index after selector sequence
   */
  private skipSelectors(morphemes: Morpheme[], first: number): number {
    for (let i = first; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      switch (morpheme.type) {
        case MorphemeType.TUPLE:
        case MorphemeType.BLOCK:
        case MorphemeType.EXPRESSION:
          /* Eat up valid selector */
          break;

        default:
          /* Stop there */
          return i;
      }
    }
    return morphemes.length;
  }
}
