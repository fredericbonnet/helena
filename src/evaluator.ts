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
import { IndexedSelector, KeyedSelector, Selector } from "./selectors";
import {
  StringValue,
  NIL,
  ScriptValue,
  TupleValue,
  Value,
  ValueType,
  ReferenceValue,
} from "./values";
import { Command } from "./command";

export interface VariableResolver {
  resolve(name: string): Value;
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
    if (word.syllables.length == 1) {
      return this.evaluateSyllable(word.syllables[0]);
    }
    switch (word.syllables[0].type) {
      case SyllableType.LITERAL:
      case SyllableType.TUPLE: {
        const [value, last] = this.evaluateReference(word.syllables, 0);
        if (last < word.syllables.length - 1) {
          throw new Error("extra characters after selectors");
        }

        return value;
      }

      case SyllableType.SUBSTITUTE_NEXT: {
        const [value, last] = this.evaluateSubstitution(word.syllables, 0);
        if (last < word.syllables.length - 1) {
          throw new Error("extra characters after selectors");
        }

        return value;
      }

      default:
        throw new Error("TODO");
    }
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

  evaluateLiteral(literal: LiteralSyllable): StringValue {
    return new StringValue(literal.value);
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
    const cmdname = args[0].asString();
    const command = this.commandResolver.resolve(cmdname);
    if (!command) throw new Error(`cannot resolve command ${cmdname}`);
    return command.evaluate(args);
  }

  evaluateString(string: StringSyllable): StringValue {
    const values: Value[] = [];
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
    return new StringValue(values.map((value) => value.asString()).join(""));
  }
  evaluateHereString(hereString: HereStringSyllable): StringValue {
    return new StringValue(hereString.value);
  }
  evaluateTaggedString(taggedString: TaggedStringSyllable): StringValue {
    return new StringValue(taggedString.value);
  }

  evaluateReference(syllables: Syllable[], first: number): [Value, number] {
    const source = syllables[first];
    const [selectors, last] = this.getSelectors(syllables, first);
    switch (source.type) {
      case SyllableType.LITERAL: {
        const varname = (source as LiteralSyllable).value;
        const value = new ReferenceValue(new StringValue(varname), selectors);
        return [value, last];
      }

      case SyllableType.TUPLE: {
        const tuple = this.evaluateTuple(source as TupleSyllable);
        const values = new ReferenceValue(tuple, selectors);
        return [values, last];
      }
    }
    throw new Error("TODO");
  }

  evaluateSubstitution(syllables: Syllable[], first: number): [Value, number] {
    if (!this.variableResolver) throw new Error("no variable resolver");
    const levels = (syllables[first] as SubstituteNextSyllable).levels;
    const source = syllables[first + 1];
    const [selectors, last] = this.getSelectors(syllables, first + 1);
    switch (source.type) {
      case SyllableType.LITERAL: {
        const varname = (source as LiteralSyllable).value;
        const variable = this.resolveVariable(varname);
        const value = this.substituteValue(variable, selectors, levels);
        return [value, last];
      }

      case SyllableType.TUPLE: {
        const tuple = this.evaluateTuple(source as TupleSyllable);
        const variables = this.resolveVariables(tuple);
        const values = this.substituteTuple(variables, selectors, levels);
        return [values, last];
      }

      case SyllableType.BLOCK: {
        const varname = (source as BlockSyllable).value;
        const variable = this.resolveVariable(varname);
        const value = this.substituteValue(variable, selectors, levels);
        return [value, last];
      }

      case SyllableType.EXPRESSION: {
        const result = this.evaluateExpression(source as ExpressionSyllable);
        switch (result.type) {
          case ValueType.TUPLE: {
            const tuple = result as TupleValue;
            const values = this.substituteTuple(
              levels > 1 ? this.resolveVariables(tuple) : tuple,
              selectors,
              levels - 1
            );
            return [values, last];
          }

          default: {
            const value = this.substituteValue(
              levels > 1 ? this.resolveVariable(result.asString()) : result,
              selectors,
              levels - 1
            );
            return [value, last];
          }
        }
      }
    }
    throw new Error("TODO");
  }
  substituteValue(value: Value, selectors: Selector[], levels: number) {
    value = this.applySelectors(value, selectors);
    return this.resolveLevels(value, levels);
  }
  substituteTuple(
    variables: TupleValue,
    selectors: Selector[],
    levels: number
  ): TupleValue {
    return this.mapTuple(variables, (variable) =>
      this.substituteValue(variable, selectors, levels)
    );
  }
  mapTuple(tuple: TupleValue, mapFn: (value: Value) => Value) {
    return new TupleValue(
      tuple.values.map((value) => {
        switch (value.type) {
          case ValueType.TUPLE:
            return this.mapTuple(value as TupleValue, mapFn);
          default:
            return mapFn(value);
        }
      })
    );
  }

  resolveVariable(varname: string): Value {
    let value = this.variableResolver.resolve(varname);
    if (!value) throw new Error(`cannot resolve variable ${varname}`);
    return value;
  }
  resolveVariables(tuple: TupleValue): TupleValue {
    return this.mapTuple(tuple, (varname) =>
      this.resolveVariable(varname.asString())
    );
  }

  resolveLevels(value: Value, levels: number): Value {
    for (let level = 1; level < levels; level++) {
      value = this.resolveVariable(value.asString());
    }
    return value;
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
  applySelectors(value: Value, selectors: Selector[]): Value {
    for (let selector of selectors) {
      value = selector.apply(value);
    }
    return value;
  }
}
