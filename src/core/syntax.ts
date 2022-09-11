export class Script {
  sentences: Sentence[] = [];
}

export class Sentence {
  words: Word[] = [];
}

export class Word {
  morphemes: Morpheme[] = [];
}

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

export interface Morpheme {
  type: MorphemeType;
}
export interface LiteralMorpheme extends Morpheme {
  value: string;
}
export interface TupleMorpheme extends Morpheme {
  subscript: Script;
}
export interface BlockMorpheme extends Morpheme {
  subscript: Script;
  value: string;
}
export interface ExpressionMorpheme extends Morpheme {
  subscript: Script;
}
export interface StringMorpheme extends Morpheme {
  morphemes: Morpheme[];
}
export interface HereStringMorpheme extends Morpheme {
  value: string;
  delimiterLength: number;
}
export interface TaggedStringMorpheme extends Morpheme {
  value: string;
  tag: string;
}
export interface LineCommentMorpheme extends Morpheme {
  value: string;
  delimiterLength: number;
}
export interface BlockCommentMorpheme extends Morpheme {
  value: string;
  delimiterLength: number;
}
export interface SubstituteNextMorpheme extends Morpheme {
  expansion: boolean;
  levels: number;
  value: string;
}

export enum WordType {
  ROOT,
  COMPOUND,
  SUBSTITUTION,
  QUALIFIED,
  IGNORED,
}

export class SyntaxChecker {
  checkWord(word: Word): WordType {
    if (word.morphemes.length == 0) throw new Error("empty word");
    switch (word.morphemes[0].type) {
      case MorphemeType.LITERAL:
        try {
          return this.checkQualifiedWord(word);
        } catch {
          return this.checkCompoundWord(word);
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
    if (word.morphemes.length != 1) throw new Error("invalid word structure");
    return WordType.ROOT;
  }

  private checkCompoundWord(word: Word): WordType {
    if (word.morphemes.length == 1) return WordType.ROOT;
    this.checkStems(word.morphemes);
    return WordType.COMPOUND;
  }

  private checkQualifiedWord(word: Word): WordType {
    if (word.morphemes.length == 1) return WordType.ROOT;
    const selectors = this.skipSelectors(word.morphemes, 1);
    if (selectors == word.morphemes.length) return WordType.QUALIFIED;
    throw new Error("invalid word structure");
  }

  private checkSubstitutionWord(word: Word): WordType {
    if (word.morphemes.length < 2) throw new Error("invalid word structure");
    let nbStems = this.checkStems(word.morphemes);
    return nbStems > 1 ? WordType.COMPOUND : WordType.SUBSTITUTION;
  }

  private checkIgnoredWord(word: Word): WordType {
    if (word.morphemes.length != 1) throw new Error("invalid word structure");
    return WordType.IGNORED;
  }

  private checkStems(morphemes: Morpheme[]): number {
    let nbStems = 0;
    let substitute = false;
    for (let i = 0; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      if (substitute) {
        switch (morpheme.type) {
          case MorphemeType.LITERAL:
          case MorphemeType.TUPLE:
          case MorphemeType.BLOCK:
          case MorphemeType.EXPRESSION:
            i = this.skipSelectors(morphemes, i + 1) - 1;
            substitute = false;
            break;

          default:
            throw new Error("invalid word structure");
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
            throw new Error("invalid word structure");
        }
      }
    }
    return nbStems;
  }

  private skipSelectors(morphemes: Morpheme[], first: number): number {
    for (let i = first; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      switch (morpheme.type) {
        case MorphemeType.TUPLE:
        case MorphemeType.BLOCK:
        case MorphemeType.EXPRESSION:
          break;

        default:
          return i;
      }
    }
    return morphemes.length;
  }
}
