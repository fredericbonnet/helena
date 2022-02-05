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
