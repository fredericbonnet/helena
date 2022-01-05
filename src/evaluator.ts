import { SyllableType, Word } from "./parser";
import {
  BlockSyllable,
  TupleSyllable,
  LiteralSyllable,
  StringSyllable,
  Syllable,
  SubstituteNextSyllable,
} from "./parser";

export interface VariableValue {
  asString(): string;
  selectKey(key: string): VariableValue;
}
export interface VariableResolver {
  resolve(name: string): VariableValue;
}

export class Evaluator {
  private variableResolver: VariableResolver;
  constructor(variableResolver: VariableResolver) {
    this.variableResolver = variableResolver;
  }

  evaluateWord(word: Word) {
    // TODO
    if (word.syllables[0].type == SyllableType.SUBSTITUTE_NEXT) {
      const [value, last] = this.evaluateSubstitution(word.syllables, 0);
      if (last < word.syllables.length - 1) {
        throw new Error("extra characters after variable selectors");
      }

      return value;
    }
    return this.evaluateSyllable(word.syllables[0]);
  }

  evaluateSyllable(syllable: Syllable) {
    switch (syllable.type) {
      case SyllableType.LITERAL:
        return this.evaluateLiteral(syllable as LiteralSyllable);
      case SyllableType.TUPLE:
        return this.evaluateTuple(syllable as TupleSyllable);
      case SyllableType.BLOCK:
        return this.evaluateBlock(syllable as BlockSyllable);
      case SyllableType.STRING:
        return this.evaluateString(syllable as StringSyllable);
    }
  }

  evaluateLiteral(literal: LiteralSyllable) {
    return literal.value;
  }
  evaluateTuple(tuple: TupleSyllable) {
    const value = [];
    for (let sentence of tuple.subscript.sentences) {
      value.push(...sentence.words.map((word) => this.evaluateWord(word)));
    }
    return value;
  }
  evaluateBlock(block: BlockSyllable) {
    return block.subscript;
  }
  evaluateString(string: StringSyllable) {
    const values = [];
    for (let i = 0; i < string.syllables.length; i++) {
      const syllable = string.syllables[i];
      if (syllable.type == SyllableType.SUBSTITUTE_NEXT) {
        const [value, last] = this.evaluateSubstitution(string.syllables, i);
        i = last;
        values.push(value);
      } else {
        values.push(this.evaluateSyllable(syllable));
      }
    }
    return values.join("");
  }

  evaluateSubstitution(syllables: Syllable[], first: number): [string, number] {
    if (!this.variableResolver) throw new Error("no variable resolver");
    const nesting = (syllables[first] as SubstituteNextSyllable).nesting;
    const varname = (syllables[first + 1] as LiteralSyllable).value;
    let value = this.variableResolver.resolve(varname);
    if (!value) throw new Error(`cannot resolve variable "${varname}"`);
    let last = first + 1;
    for (let i = last + 1; i < syllables.length; i++, last++) {
      const selector = syllables[i];
      if (selector.type == SyllableType.TUPLE) {
        const tuple = this.evaluateTuple(selector as TupleSyllable);
        if (tuple.length == 0) throw new Error("empty selector");
        for (let key of tuple) {
          value = value.selectKey(key);
        }
      } else {
        break;
      }
    }
    for (let level = 1; level < nesting; level++) {
      value = this.variableResolver.resolve(value.asString());
    }
    return [value.asString(), last];
  }
}
