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
  SyntaxChecker,
  WordType,
} from "./syntax";
import { IndexedSelector, KeyedSelector, Selector } from "./selectors";
import {
  StringValue,
  NIL,
  ScriptValue,
  TupleValue,
  Value,
  ValueType,
  QualifiedValue,
} from "./values";
import { Command } from "./command";
import { Compiler, Context, SubstituteResult } from "./compiler";

export interface VariableResolver {
  resolve(name: string): Value;
}
export interface CommandResolver {
  resolve(name: string): Command;
}

export interface Evaluator {
  evaluateScript(script: Script);
  evaluateSentence(sentence: Sentence): Value;
  evaluateWord(word: Word): Value;
}

export class InlineEvaluator implements Evaluator {
  private variableResolver: VariableResolver;
  private commandResolver: CommandResolver;
  private syntaxChecker: SyntaxChecker = new SyntaxChecker();

  constructor(
    variableResolver: VariableResolver,
    commandResolver: CommandResolver
  ) {
    this.variableResolver = variableResolver;
    this.commandResolver = commandResolver;
  }

  /*
   * Scripts
   */

  evaluateScript(script: Script) {
    let value: Value = NIL;
    for (let sentence of script.sentences) {
      value = this.evaluateSentence(sentence);
    }
    return value;
  }

  /*
   * Sentences
   */

  evaluateSentence(sentence: Sentence): Value {
    if (!this.commandResolver) throw new Error("no command resolver");
    if (sentence.words.length == 0) return NIL;
    const args = sentence.words.map((word) => this.evaluateWord(word));
    const cmdname = args[0].asString();
    const command = this.commandResolver.resolve(cmdname);
    if (!command) throw new Error(`cannot resolve command ${cmdname}`);
    return command.evaluate(args);
  }

  /*
   * Words
   */

  evaluateWord(word: Word): Value {
    switch (this.syntaxChecker.checkWord(word)) {
      case WordType.ROOT:
        return this.evaluateMorpheme(word.morphemes[0]);

      case WordType.COMPOUND: {
        const values: Value[] = [];
        for (let i = 0; i < word.morphemes.length; i++) {
          const morpheme = word.morphemes[i];
          if (morpheme.type == MorphemeType.SUBSTITUTE_NEXT) {
            const [value, last] = this.evaluateSubstitution(word.morphemes, i);
            i = last;
            values.push(value);
          } else {
            values.push(this.evaluateMorpheme(morpheme));
          }
        }
        return new StringValue(
          values.map((value) => value.asString()).join("")
        );
      }

      case WordType.SUBSTITUTION: {
        const [value] = this.evaluateSubstitution(word.morphemes, 0);
        return value;
      }

      case WordType.QUALIFIED:
        return this.evaluateQualified(word.morphemes);

      case WordType.IGNORED:
        throw "TODO";

      default:
        throw new Error("unknown word type");
    }
  }

  /*
   * Morphemes
   */

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

  /*
   * Literals
   */

  evaluateLiteral(literal: LiteralMorpheme): StringValue {
    return new StringValue(literal.value);
  }

  /*
   * Tuples
   */

  evaluateTuple(tuple: TupleMorpheme): TupleValue {
    const value: Value[] = [];
    for (let sentence of tuple.subscript.sentences) {
      value.push(...sentence.words.map((word) => this.evaluateWord(word)));
    }
    return new TupleValue(value);
  }
  private mapTuple(tuple: TupleValue, mapFn: (value: Value) => Value) {
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

  /*
   * Blocks
   */

  evaluateBlock(block: BlockMorpheme): ScriptValue {
    return new ScriptValue(block.subscript, block.value);
  }

  /*
   * Expressions
   */

  evaluateExpression(expression: ExpressionMorpheme): Value {
    const script = (expression as ExpressionMorpheme).subscript;
    return this.evaluateScript(script);
  }

  /*
   * Strings
   */

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

  /*
   * Here-strings
   */

  evaluateHereString(hereString: HereStringMorpheme): StringValue {
    return new StringValue(hereString.value);
  }

  /*
   * Tagged strings
   */

  evaluateTaggedString(taggedString: TaggedStringMorpheme): StringValue {
    return new StringValue(taggedString.value);
  }

  /*
   * Qualified words
   */

  private evaluateQualified(morphemes: Morpheme[]): Value {
    const source = morphemes[0];
    const [selectors] = this.getSelectors(morphemes, 0);
    switch (source.type) {
      case MorphemeType.LITERAL: {
        const varname = (source as LiteralMorpheme).value;
        const value = new QualifiedValue(new StringValue(varname), selectors);
        return value;
      }

      case MorphemeType.TUPLE: {
        const tuple = this.evaluateTuple(source as TupleMorpheme);
        const values = new QualifiedValue(tuple, selectors);
        return values;
      }
    }
    throw new Error("CANTHAPPEN");
  }

  /*
   * Substitutions
   */

  private evaluateSubstitution(
    morphemes: Morpheme[],
    first: number
  ): [Value, number] {
    if (!this.variableResolver) throw new Error("no variable resolver");
    const levels = (morphemes[first] as SubstituteNextMorpheme).levels;
    const source = morphemes[first + 1];
    const [selectors, last] = this.getSelectors(morphemes, first + 1);
    let value;
    switch (source.type) {
      case MorphemeType.LITERAL: {
        const varname = (source as LiteralMorpheme).value;
        value = this.resolveVariable(varname);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = this.evaluateTuple(source as TupleMorpheme);
        value = this.resolveVariables(tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const varname = (source as BlockMorpheme).value;
        value = this.resolveVariable(varname);
        break;
      }

      case MorphemeType.EXPRESSION:
        value = this.evaluateExpression(source as ExpressionMorpheme);
        break;

      default:
        throw new Error("TODO");
    }
    value = this.applySelectors(value, selectors);
    value = this.resolveLevels(value, levels);
    return [value, last];
  }

  /*
   * Variables
   */

  private resolveVariable(varname: string): Value {
    let value = this.variableResolver.resolve(varname);
    if (!value) throw new Error(`cannot resolve variable ${varname}`);
    return value;
  }
  private resolveVariables(tuple: TupleValue): TupleValue {
    return this.mapTuple(tuple, (varname) =>
      this.resolveVariable(varname.asString())
    );
  }
  private resolveValue(source: Value) {
    if (source.type == ValueType.TUPLE) {
      return this.resolveVariables(source as TupleValue);
    } else {
      return this.resolveVariable(source.asString());
    }
  }
  private resolveLevels(value: Value, levels: number): Value {
    for (let level = 1; level < levels; level++) {
      value = this.resolveValue(value);
    }
    return value;
  }

  /*
   * Selectors
   */

  private getSelectors(
    morphemes: Morpheme[],
    first: number
  ): [Selector[], number] {
    let last = first;
    const selectors: Selector[] = [];
    for (let i = last + 1; i < morphemes.length; i++, last++) {
      const selector = this.getSelector(morphemes[i]);
      if (!selector) break;
      selectors.push(selector);
    }
    return [selectors, last];
  }
  private getSelector(morpheme: Morpheme): Selector {
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
  private applySelectors(value: Value, selectors: Selector[]): Value {
    for (let selector of selectors) {
      value = selector.apply(value);
    }
    return value;
  }
}

export class CompilingEvaluator implements Evaluator {
  private variableResolver: VariableResolver;
  private commandResolver: CommandResolver;
  private compiler: Compiler;
  private context: Context;

  constructor(
    variableResolver: VariableResolver,
    commandResolver: CommandResolver
  ) {
    this.variableResolver = variableResolver;
    this.commandResolver = commandResolver;
    this.compiler = new Compiler();
    this.context = new Context(this.variableResolver, this.commandResolver);
  }

  evaluateScript(script: Script) {
    const program = this.compiler.compileScript(script);
    return this.context.execute([...program, new SubstituteResult()]);
  }

  evaluateSentence(sentence: Sentence): Value {
    const script = new Script();
    script.sentences.push(sentence);
    const program = this.compiler.compileScript(script);
    return this.context.execute([...program, new SubstituteResult()]);
  }

  evaluateWord(word: Word): Value {
    const program = this.compiler.compileWord(word);
    return this.context.execute(program);
  }
}
