import {
  Sentence,
  Word,
  Script,
  MorphemeType,
  Morpheme,
  LiteralMorpheme,
  TupleMorpheme,
  BlockMorpheme,
  ExpressionMorpheme,
  StringMorpheme,
  HereStringMorpheme,
  TaggedStringMorpheme,
  SubstituteNextMorpheme,
} from "./syntax";
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
    if (word.morphemes.length == 1) {
      return this.evaluateMorpheme(word.morphemes[0]);
    }
    switch (word.morphemes[0].type) {
      case MorphemeType.LITERAL:
      case MorphemeType.TUPLE: {
        const [value, last] = this.evaluateReference(word.morphemes, 0);
        if (last < word.morphemes.length - 1) {
          throw new Error("extra characters after selectors");
        }

        return value;
      }

      case MorphemeType.SUBSTITUTE_NEXT: {
        const [value, last] = this.evaluateSubstitution(word.morphemes, 0);
        if (last < word.morphemes.length - 1) {
          throw new Error("extra characters after selectors");
        }

        return value;
      }

      default:
        throw new Error("TODO");
    }
  }

  evaluateMorpheme(morpheme: Morpheme): Value {
    switch (morpheme.type) {
      case MorphemeType.LITERAL:
        return this.evaluateLiteral(morpheme as LiteralMorpheme);
      case MorphemeType.TUPLE:
        return this.evaluateTuple(morpheme as TupleMorpheme);
      case MorphemeType.BLOCK:
        return this.evaluateBlock(morpheme as BlockMorpheme);
      case MorphemeType.EXPRESSION:
        return this.evaluateExpression(morpheme as ExpressionMorpheme);
      case MorphemeType.STRING:
        return this.evaluateString(morpheme as StringMorpheme);
      case MorphemeType.HERE_STRING:
        return this.evaluateHereString(morpheme as HereStringMorpheme);
      case MorphemeType.TAGGED_STRING:
        return this.evaluateTaggedString(morpheme as TaggedStringMorpheme);
      case MorphemeType.LINE_COMMENT:
      case MorphemeType.BLOCK_COMMENT:
      case MorphemeType.SUBSTITUTE_NEXT:
      default:
        throw new Error("TODO");
    }
  }

  evaluateLiteral(literal: LiteralMorpheme): StringValue {
    return new StringValue(literal.value);
  }
  evaluateTuple(tuple: TupleMorpheme): TupleValue {
    const value: Value[] = [];
    for (let sentence of tuple.subscript.sentences) {
      value.push(...sentence.words.map((word) => this.evaluateWord(word)));
    }
    return new TupleValue(value);
  }
  evaluateBlock(block: BlockMorpheme): ScriptValue {
    return new ScriptValue(block.subscript);
  }
  evaluateExpression(expression: ExpressionMorpheme): Value {
    if (!this.commandResolver) throw new Error("no command resolver");
    const script = (expression as ExpressionMorpheme).subscript;
    return this.evaluateScript(script);
  }
  evaluateScript(script: Script) {
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

  evaluateString(string: StringMorpheme): StringValue {
    const values: Value[] = [];
    for (let i = 0; i < string.morphemes.length; i++) {
      const morpheme = string.morphemes[i];
      if (morpheme.type == MorphemeType.SUBSTITUTE_NEXT) {
        const [value, last] = this.evaluateSubstitution(string.morphemes, i);
        i = last;
        values.push(value);
      } else {
        values.push(this.evaluateMorpheme(morpheme));
      }
    }
    return new StringValue(values.map((value) => value.asString()).join(""));
  }
  evaluateHereString(hereString: HereStringMorpheme): StringValue {
    return new StringValue(hereString.value);
  }
  evaluateTaggedString(taggedString: TaggedStringMorpheme): StringValue {
    return new StringValue(taggedString.value);
  }

  evaluateReference(morphemes: Morpheme[], first: number): [Value, number] {
    const source = morphemes[first];
    const [selectors, last] = this.getSelectors(morphemes, first);
    switch (source.type) {
      case MorphemeType.LITERAL: {
        const varname = (source as LiteralMorpheme).value;
        const value = new ReferenceValue(new StringValue(varname), selectors);
        return [value, last];
      }

      case MorphemeType.TUPLE: {
        const tuple = this.evaluateTuple(source as TupleMorpheme);
        const values = new ReferenceValue(tuple, selectors);
        return [values, last];
      }
    }
    throw new Error("TODO");
  }

  evaluateSubstitution(morphemes: Morpheme[], first: number): [Value, number] {
    if (!this.variableResolver) throw new Error("no variable resolver");
    const levels = (morphemes[first] as SubstituteNextMorpheme).levels;
    const source = morphemes[first + 1];
    const [selectors, last] = this.getSelectors(morphemes, first + 1);
    switch (source.type) {
      case MorphemeType.LITERAL: {
        const varname = (source as LiteralMorpheme).value;
        const variable = this.resolveVariable(varname);
        const value = this.substituteValue(variable, selectors, levels);
        return [value, last];
      }

      case MorphemeType.TUPLE: {
        const tuple = this.evaluateTuple(source as TupleMorpheme);
        const variables = this.resolveVariables(tuple);
        const values = this.substituteTuple(variables, selectors, levels);
        return [values, last];
      }

      case MorphemeType.BLOCK: {
        const varname = (source as BlockMorpheme).value;
        const variable = this.resolveVariable(varname);
        const value = this.substituteValue(variable, selectors, levels);
        return [value, last];
      }

      case MorphemeType.EXPRESSION: {
        const result = this.evaluateExpression(source as ExpressionMorpheme);
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

  getSelectors(morphemes: Morpheme[], first: number): [Selector[], number] {
    let last = first;
    const selectors: Selector[] = [];
    for (let i = last + 1; i < morphemes.length; i++, last++) {
      const selector = this.getSelector(morphemes[i]);
      if (!selector) break;
      selectors.push(selector);
    }
    return [selectors, last];
  }
  getSelector(morpheme: Morpheme): Selector {
    switch (morpheme.type) {
      case MorphemeType.TUPLE: {
        const keys = this.evaluateTuple(morpheme as TupleMorpheme).values;
        return new KeyedSelector(keys);
      }

      case MorphemeType.EXPRESSION: {
        const index = this.evaluateExpression(morpheme as ExpressionMorpheme);
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
