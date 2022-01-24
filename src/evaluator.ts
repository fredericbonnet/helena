import {
  BlockSyllable,
  ExpressionSyllable,
  HereStringSyllable,
  LiteralSyllable,
  Sentence,
  StringSyllable,
  SubstituteNextSyllable,
  Syllable,
  SyllableType,
  TaggedStringSyllable,
  TupleSyllable,
  Word,
} from "./parser";
import { Reference } from "./reference";
import { IndexedSelector, KeyedSelector, Selector } from "./selectors";
import {
  LiteralValue,
  NIL,
  ScriptValue,
  TupleValue,
  Value,
  ValueType,
} from "./values";
import { Command } from "./command";

export interface VariableResolver {
  resolve(name: string): Reference;
}
export interface CommandResolver {
  resolve(name: string): Command;
}

export class Evaluator {
  private variableResolver: VariableResolver;
  private commandResolver: CommandResolver;
  constructor(
    variableResolver: VariableResolver,
    commandResolver: CommandResolver
  ) {
    this.variableResolver = variableResolver;
    this.commandResolver = commandResolver;
  }

  evaluateWord(word: Word): Value {
    // TODO
    if (word.syllables[0].type == SyllableType.SUBSTITUTE_NEXT) {
      const [value, last] = this.evaluateSubstitution(word.syllables, 0);
      if (last < word.syllables.length - 1) {
        throw new Error("extra characters after selectors");
      }

      return value;
    }
    return this.evaluateSyllable(word.syllables[0]);
  }

  evaluateSyllable(syllable: Syllable): Value {
    switch (syllable.type) {
      case SyllableType.LITERAL:
        return this.evaluateLiteral(syllable as LiteralSyllable);
      case SyllableType.TUPLE:
        return this.evaluateTuple(syllable as TupleSyllable);
      case SyllableType.BLOCK:
        return this.evaluateBlock(syllable as BlockSyllable);
      case SyllableType.EXPRESSION:
        return this.evaluateExpression(syllable as ExpressionSyllable);
      case SyllableType.STRING:
        return this.evaluateString(syllable as StringSyllable);
      case SyllableType.HERE_STRING:
        return this.evaluateHereString(syllable as HereStringSyllable);
      case SyllableType.TAGGED_STRING:
        return this.evaluateTaggedString(syllable as TaggedStringSyllable);
      case SyllableType.LINE_COMMENT:
      case SyllableType.BLOCK_COMMENT:
      case SyllableType.SUBSTITUTE_NEXT:
      default:
        throw new Error("TODO");
    }
  }

  evaluateLiteral(literal: LiteralSyllable): LiteralValue {
    return new LiteralValue(literal.value);
  }
  evaluateTuple(tuple: TupleSyllable): TupleValue {
    const value: Value[] = [];
    for (let sentence of tuple.subscript.sentences) {
      value.push(...sentence.words.map((word) => this.evaluateWord(word)));
    }
    return new TupleValue(value);
  }
  evaluateBlock(block: BlockSyllable): ScriptValue {
    return new ScriptValue(block.subscript);
  }
  evaluateExpression(expression: ExpressionSyllable): Value {
    if (!this.commandResolver) throw new Error("no command resolver");
    const script = (expression as ExpressionSyllable).subscript;
    let value: Value = NIL;
    for (let sentence of script.sentences) {
      value = this.evaluateSentence(sentence);
    }
    return value;
  }
  evaluateSentence(sentence: Sentence): Value {
    if (sentence.words.length == 0) return NIL;
    const args = sentence.words.map((word) => this.evaluateWord(word));
    const cmdname = (args[0] as LiteralValue).value;
    const command = this.commandResolver.resolve(cmdname);
    if (!command) throw new Error(`cannot resolve command ${cmdname}`);
    return command.evaluate(args);
  }

  evaluateString(string: StringSyllable): LiteralValue {
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
    return new LiteralValue(
      values.map((value) => (value as LiteralSyllable).value).join("")
    );
  }
  evaluateHereString(hereString: HereStringSyllable): LiteralValue {
    return new LiteralValue(hereString.value);
  }
  evaluateTaggedString(taggedString: TaggedStringSyllable): LiteralValue {
    return new LiteralValue(taggedString.value);
  }

  evaluateSubstitution(syllables: Syllable[], first: number): [Value, number] {
    if (!this.variableResolver) throw new Error("no variable resolver");
    const nesting = (syllables[first] as SubstituteNextSyllable).nesting;
    const source = syllables[first + 1];
    const [selectors, last] = this.getSelectors(syllables, first + 1);
    switch (source.type) {
      case SyllableType.LITERAL: {
        const varname = (source as LiteralSyllable).value;
        const value = this.substituteLiteral(varname, selectors, nesting);
        return [value, last];
      }

      case SyllableType.TUPLE: {
        const sources = this.evaluateTuple(source as TupleSyllable).values;
        const values = this.substituteTuple(sources, selectors, nesting);
        return [values, last];
      }

      case SyllableType.EXPRESSION: {
        const result = this.evaluateExpression(source as ExpressionSyllable);
        if (nesting > 1) {
          switch (result.type) {
            case ValueType.LITERAL: {
              const varname = (result as LiteralValue).value;
              const value = this.substituteLiteral(
                varname,
                [] /*TODO*/,
                nesting - 1
              );
              return [value, last];
            }

            case ValueType.TUPLE: {
              const sources = (result as TupleValue).values;
              const values = this.substituteTuple(
                sources,
                [] /*TODO*/,
                nesting - 1
              );
              return [values, last];
            }
          }
        } else {
          return [result, last];
        }
      }
    }
    throw new Error("TODO");
  }
  substituteLiteral(varname: string, selectors, nesting) {
    let variable = this.getVariableReference(varname);
    const reference = this.applySelectors(variable, selectors);
    return this.resolveNestedReference(reference, nesting).getValue();
  }
  substituteTuple(sources: Value[], selectors, nesting: number): TupleValue {
    return new TupleValue(
      sources.map((source) => {
        switch (source.type) {
          case ValueType.LITERAL:
            return this.substituteLiteral(
              (source as LiteralValue).value,
              selectors,
              nesting
            );

          case ValueType.TUPLE:
            return this.substituteTuple(
              (source as TupleValue).values,
              selectors,
              nesting
            );
        }
      })
    );
  }

  getVariableReference(varname: string): Reference {
    let reference = this.variableResolver.resolve(varname);
    if (!reference) throw new Error(`cannot resolve variable ${varname}`);
    return reference;
  }
  resolveNestedReference(reference: Reference, nesting: number): Reference {
    for (let level = 1; level < nesting; level++) {
      reference = this.getVariableReference(
        (reference.getValue() as LiteralValue).value
      );
    }
    return reference;
  }

  getSelectors(syllables: Syllable[], first: number): [Selector[], number] {
    let last = first;
    const selectors: Selector[] = [];
    for (let i = last + 1; i < syllables.length; i++, last++) {
      const selector = this.getSelector(syllables[i]);
      if (!selector) break;
      selectors.push(selector);
    }
    return [selectors, last];
  }
  getSelector(syllable: Syllable): Selector {
    switch (syllable.type) {
      case SyllableType.TUPLE: {
        const keys = this.evaluateTuple(syllable as TupleSyllable).values;
        return new KeyedSelector(keys);
      }

      case SyllableType.EXPRESSION: {
        const index = this.evaluateExpression(syllable as ExpressionSyllable);
        return new IndexedSelector(index);
      }
    }
    return null;
  }
  applySelectors(reference: Reference, selectors: Selector[]): Reference {
    for (let selector of selectors) {
      reference = selector.apply(reference);
    }
    return reference;
  }
}
