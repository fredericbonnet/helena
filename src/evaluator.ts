import {
  ExpressionSyllable,
  Script,
  Sentence,
  SyllableType,
  Word,
} from "./parser";
import {
  BlockSyllable,
  TupleSyllable,
  LiteralSyllable,
  StringSyllable,
  Syllable,
  SubstituteNextSyllable,
} from "./parser";

export enum ValueType {
  NIL,
  LITERAL,
  TUPLE,
  SCRIPT,
}

export class NilValue {
  type: ValueType.NIL;
}
export const NIL = new NilValue();
export class LiteralValue {
  type: ValueType = ValueType.LITERAL;
  value: string;
  constructor(value: string) {
    this.value = value;
  }
}
export class TupleValue {
  type: ValueType = ValueType.TUPLE;
  values: Value[];
  constructor(values: Value[]) {
    this.values = [...values];
  }
}
export class ScriptValue {
  type: ValueType = ValueType.SCRIPT;
  script: Script;
  constructor(script: Script) {
    this.script = script;
  }
}
export type Value = NilValue | LiteralValue | TupleValue | ScriptValue;

export interface Reference {
  value(): Value;
  selectKey(key: Value): Reference;
}
export interface VariableResolver {
  resolve(name: string): Reference;
}

export interface Command {
  evaluate(args: Value[]): Value;
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
        throw new Error("extra characters after variable selectors");
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
    if (!command) throw new Error(`cannot resolve command ${command}`);
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

  evaluateSubstitution(syllables: Syllable[], first: number): [Value, number] {
    if (!this.variableResolver) throw new Error("no variable resolver");
    const nesting = (syllables[first] as SubstituteNextSyllable).nesting;
    switch (syllables[first + 1].type) {
      case SyllableType.LITERAL: {
        const varname = (syllables[first + 1] as LiteralSyllable).value;
        const [selectors, last] = this.getSelectors(syllables, first + 1);
        const value = this.evaluateVariable(varname, selectors, nesting);
        return [value, last];
      }

      case SyllableType.TUPLE: {
        const varnames = this.evaluateTuple(
          syllables[first + 1] as TupleSyllable
        ).values;
        const [selectors, last] = this.getSelectors(syllables, first + 1);
        const values = this.evaluateVariables(varnames, selectors, nesting);
        return [values, last];
      }
    }
  }
  evaluateVariable(varname: string, selectors, nesting) {
    let variable = this.getVariableReference(varname);
    const reference = this.applySelectors(variable, selectors);
    return this.resolveNestedReference(reference, nesting).value();
  }
  evaluateVariables(varnames: Value[], selectors, nesting: number): TupleValue {
    return new TupleValue(
      varnames.map((varname) => {
        switch (varname.type) {
          case ValueType.LITERAL:
            return this.evaluateVariable(
              (varname as LiteralValue).value,
              selectors,
              nesting
            );

          case ValueType.TUPLE:
            return this.evaluateVariables(
              (varname as TupleValue).values,
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
        (reference.value() as LiteralValue).value
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
    if (syllable.type == SyllableType.TUPLE) {
      const keys = this.evaluateTuple(syllable as TupleSyllable).values;
      return new KeyedSelector(keys);
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

interface Selector {
  apply(reference: Reference): Reference;
}

class KeyedSelector implements Selector {
  keys: Value[];
  constructor(keys: Value[]) {
    if (keys.length == 0) throw new Error("empty selector");
    this.keys = keys;
  }
  apply(reference: Reference): Reference {
    for (let key of this.keys) {
      reference = reference.selectKey(key);
    }
    return reference;
  }
}
