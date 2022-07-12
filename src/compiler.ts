import {
  CommandResolver,
  SelectorResolver,
  VariableResolver,
} from "./evaluator";
import { IndexedSelector, KeyedSelector } from "./selectors";
import {
  BlockMorpheme,
  ExpressionMorpheme,
  HereStringMorpheme,
  LiteralMorpheme,
  Morpheme,
  MorphemeType,
  Script,
  Sentence,
  StringMorpheme,
  SubstituteNextMorpheme,
  SyntaxChecker,
  TaggedStringMorpheme,
  TupleMorpheme,
  Word,
  WordType,
} from "./syntax";
import {
  NIL,
  QualifiedValue,
  ScriptValue,
  StringValue,
  TupleValue,
  Value,
  ValueType,
} from "./values";

export class Compiler {
  private syntaxChecker: SyntaxChecker = new SyntaxChecker();

  compile(script: Script): Operation[] {
    const result: Operation[] = [];
    for (let sentence of script.sentences) {
      result.push(...this.compileSentence(sentence));
    }
    return result;
  }
  compileScript(script: Script): Operation[] {
    const result: Operation[] = [];
    for (let sentence of script.sentences) {
      result.push(new OpenFrame());
      result.push(...this.compileSentence(sentence));
      result.push(new CloseFrame());
      result.push(new EvaluateSentence());
    }
    return result;
  }
  compileSentence(sentence: Sentence) {
    const result: Operation[] = [];
    for (let word of sentence.words) {
      result.push(...this.compileWord(word));
    }
    return result;
  }
  compileWord(word: Word): Operation[] {
    switch (this.syntaxChecker.checkWord(word)) {
      case WordType.ROOT:
        return this.compileRoot(word.morphemes[0]);
      case WordType.COMPOUND:
        return this.compileCompound(word.morphemes);
      case WordType.SUBSTITUTION:
        return this.compileSubstitution(word.morphemes);
      case WordType.QUALIFIED:
        return this.compileQualified(word.morphemes);
      case WordType.IGNORED:
        return [];
      default:
        throw new Error("unknown word type");
    }
  }
  compileRoot(root: Morpheme): Operation[] {
    const result: Operation[] = [];
    switch (root.type) {
      case MorphemeType.LITERAL: {
        const literal = root as LiteralMorpheme;
        this.emitLiteral(result, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = root as TupleMorpheme;
        this.emitTuple(result, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = root as BlockMorpheme;
        this.emitBlock(result, block);
        break;
      }

      case MorphemeType.EXPRESSION: {
        const expression = root as ExpressionMorpheme;
        this.emitExpression(result, expression);
        break;
      }

      case MorphemeType.STRING: {
        const string = root as StringMorpheme;
        this.emitString(result, string);
        break;
      }

      case MorphemeType.HERE_STRING: {
        const string = root as HereStringMorpheme;
        this.emitHereString(result, string);
        break;
      }

      case MorphemeType.TAGGED_STRING: {
        const string = root as TaggedStringMorpheme;
        this.emitTaggedString(result, string);
        break;
      }

      default:
        throw new Error("unexpected morpheme");
    }
    return result;
  }
  compileCompound(morphemes: Morpheme[]): Operation[] {
    return [
      new OpenFrame(),
      ...this.compileStems(morphemes),
      new CloseFrame(),
      new JoinStrings(),
    ];
  }
  compileSubstitution(morphemes: Morpheme[]): Operation[] {
    const result: Operation[] = [];
    const substitute = morphemes[0] as SubstituteNextMorpheme;
    const selectable = morphemes[1];
    switch (selectable.type) {
      case MorphemeType.LITERAL: {
        const literal = selectable as LiteralMorpheme;
        this.emitLiteralVarname(result, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = selectable as TupleMorpheme;
        this.emitTupleVarnames(result, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = selectable as BlockMorpheme;
        this.emitBlockVarname(result, block);
        break;
      }

      case MorphemeType.EXPRESSION: {
        const expression = selectable as ExpressionMorpheme;
        this.emitExpression(result, expression);
        break;
      }

      default:
        throw new Error("unexpected morpheme");
    }
    for (let i = 2; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      switch (morpheme.type) {
        case MorphemeType.TUPLE: {
          const tuple = morpheme as TupleMorpheme;
          this.emitKeyedSelector(result, tuple);
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          this.emitSelector(result, block);
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          this.emitIndexedSelector(result, expression);
          break;
        }

        default:
          throw new Error("unexpected morpheme");
      }
    }
    for (let level = 1; level < substitute.levels; level++) {
      result.push(new ResolveValue());
    }
    if (substitute.expansion) {
      result.push(new ExpandValue());
    }
    return result;
  }
  compileQualified(morphemes: Morpheme[]): Operation[] {
    const result: Operation[] = [];
    const selectable = morphemes[0];
    switch (selectable.type) {
      case MorphemeType.LITERAL: {
        const literal = selectable as LiteralMorpheme;
        this.emitLiteralSource(result, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = selectable as TupleMorpheme;
        this.emitTupleSource(result, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = selectable as BlockMorpheme;
        this.emitBlockSource(result, block);
        break;
      }

      default:
        throw new Error("unexpected morpheme");
    }
    for (let i = 1; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      switch (morpheme.type) {
        case MorphemeType.TUPLE: {
          const tuple = morpheme as TupleMorpheme;
          this.emitKeyedSelector(result, tuple);
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          this.emitSelector(result, block);
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          this.emitIndexedSelector(result, expression);
          break;
        }

        default:
          throw new Error("unexpected morpheme");
      }
    }
    return result;
  }
  compileStems(morphemes: Morpheme[]): Operation[] {
    const result: Operation[] = [];
    let mode: "" | "substitute" | "selectable" = "";
    let substitute: SubstituteNextMorpheme;
    for (let morpheme of morphemes) {
      switch (morpheme.type) {
        case MorphemeType.SUBSTITUTE_NEXT:
          mode = "substitute";
          substitute = morpheme as SubstituteNextMorpheme;
          break;

        case MorphemeType.LITERAL: {
          const literal = morpheme as LiteralMorpheme;
          if (mode == "substitute") {
            this.emitLiteralVarname(result, literal);
            mode = "selectable";
          } else {
            this.emitLiteral(result, literal);
            mode = "";
          }
          break;
        }

        case MorphemeType.TUPLE: {
          const tuple = morpheme as TupleMorpheme;
          if (mode == "selectable") {
            this.emitKeyedSelector(result, tuple);
          } else if (mode == "substitute") {
            this.emitTupleVarnames(result, tuple);
            mode = "selectable";
          } else {
            this.emitTuple(result, tuple);
            mode = "";
          }
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          if (mode == "substitute") {
            this.emitBlockVarname(result, block);
            mode = "selectable";
          } else {
            this.emitBlock(result, block);
            mode = "";
          }
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          if (mode == "selectable") {
            this.emitIndexedSelector(result, expression);
          } else if (mode == "substitute") {
            this.emitExpression(result, expression);
            mode = "selectable";
          } else {
            this.emitExpression(result, expression);
            mode = "";
          }
          break;
        }

        case MorphemeType.STRING: {
          const string = morpheme as StringMorpheme;
          this.emitString(result, string);
          break;
        }

        case MorphemeType.HERE_STRING: {
          const string = morpheme as HereStringMorpheme;
          this.emitHereString(result, string);
          break;
        }

        case MorphemeType.TAGGED_STRING: {
          const string = morpheme as TaggedStringMorpheme;
          this.emitTaggedString(result, string);
          break;
        }

        default:
          throw new Error("unknown morpheme");
      }
    }
    if (substitute) {
      for (let level = 1; level < substitute.levels; level++) {
        result.push(new ResolveValue());
      }
    }
    return result;
  }

  private emitLiteral(result: Operation[], literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    result.push(new PushValue(value));
  }
  private emitTuple(result: Operation[], tuple: TupleMorpheme) {
    result.push(new OpenFrame());
    result.push(...this.compile(tuple.subscript));
    result.push(new CloseFrame());
  }
  private emitBlock(result: Operation[], block: BlockMorpheme) {
    const value = new ScriptValue(block.subscript, block.value);
    result.push(new PushValue(value));
  }
  private emitExpression(result: Operation[], expression: ExpressionMorpheme) {
    result.push(...this.compileScript(expression.subscript));
    result.push(new SubstituteResult());
  }
  private emitString(result: Operation[], string: StringMorpheme) {
    result.push(new OpenFrame());
    result.push(...this.compileStems(string.morphemes));
    result.push(new CloseFrame());
    result.push(new JoinStrings());
  }
  private emitHereString(result: Operation[], string: HereStringMorpheme) {
    const value = new StringValue(string.value);
    result.push(new PushValue(value));
  }
  private emitTaggedString(result: Operation[], string: TaggedStringMorpheme) {
    const value = new StringValue(string.value);
    result.push(new PushValue(value));
  }
  private emitLiteralVarname(result: Operation[], literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    result.push(new PushValue(value));
    result.push(new ResolveValue());
  }
  private emitTupleVarnames(result: Operation[], tuple: TupleMorpheme) {
    result.push(new OpenFrame());
    result.push(...this.compile(tuple.subscript));
    result.push(new CloseFrame());
    result.push(new ResolveValue());
  }
  private emitBlockVarname(result: Operation[], block: BlockMorpheme) {
    const value = new StringValue(block.value);
    result.push(new PushValue(value));
    result.push(new ResolveValue());
  }
  private emitLiteralSource(result: Operation[], literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    result.push(new PushValue(value));
    result.push(new SetSource());
  }
  private emitTupleSource(result: Operation[], tuple: TupleMorpheme) {
    result.push(new OpenFrame());
    result.push(...this.compile(tuple.subscript));
    result.push(new CloseFrame());
    result.push(new SetSource());
  }
  private emitBlockSource(result: Operation[], block: BlockMorpheme) {
    const value = new StringValue(block.value);
    result.push(new PushValue(value));
    result.push(new SetSource());
  }
  private emitKeyedSelector(result: Operation[], tuple: TupleMorpheme) {
    result.push(new OpenFrame());
    result.push(...this.compile(tuple.subscript));
    result.push(new CloseFrame());
    result.push(new SelectKeys());
  }
  private emitIndexedSelector(
    result: Operation[],
    expression: ExpressionMorpheme
  ) {
    result.push(...this.compileScript(expression.subscript));
    result.push(new SubstituteResult());
    result.push(new SelectIndex());
  }
  private emitSelector(result: Operation[], block: BlockMorpheme) {
    result.push(new OpenFrame());
    for (let sentence of block.subscript.sentences) {
      result.push(new OpenFrame());
      result.push(...this.compileSentence(sentence));
      result.push(new CloseFrame());
    }
    result.push(new CloseFrame());
    result.push(new SelectRules());
  }
}
export interface Operation {
  execute(context: Context);
}
export class PushValue implements Operation {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
  execute(context: Context) {
    context.push(this.value);
  }
}
export class OpenFrame implements Operation {
  execute(context: Context) {
    context.openFrame();
  }
}
export class CloseFrame implements Operation {
  execute(context: Context) {
    const values = context.closeFrame();
    context.push(new TupleValue(values));
  }
}
export class ResolveValue implements Operation {
  execute(context: Context) {
    const source = context.pop();
    context.push(context.resolveValue(source));
  }
}
export class ExpandValue implements Operation {
  execute(context: Context) {
    context.expand();
  }
}
export class SetSource implements Operation {
  execute(context: Context) {
    const source = context.pop();
    context.push(new QualifiedValue(source, []));
  }
}
export class SelectIndex implements Operation {
  execute(context: Context) {
    const index = context.pop();
    const selector = new IndexedSelector(index);
    const value = context.pop();
    context.push(selector.apply(value));
  }
}
export class SelectKeys implements Operation {
  execute(context: Context) {
    const keys = context.pop() as TupleValue;
    const selector = new KeyedSelector(keys.values);
    const value = context.pop();
    context.push(selector.apply(value));
  }
}
export class SelectRules implements Operation {
  execute(context: Context) {
    const rules = context.pop() as TupleValue;
    const selector = context.resolveSelector(rules.values);
    const value = context.pop();
    context.push(selector.apply(value));
  }
}
export class EvaluateSentence implements Operation {
  execute(context: Context) {
    const args = context.pop() as TupleValue;
    if (args.values.length == 0) return;
    const command = context.resolveCommand(args.values);
    context.result = command.evaluate(args.values);
  }
}
export class SubstituteResult implements Operation {
  execute(context: Context) {
    context.push(context.result);
  }
}
export class JoinStrings implements Operation {
  execute(context: Context) {
    const tuple = context.pop() as TupleValue;
    const chunks = tuple.values.map((value) => value.asString());
    context.push(new StringValue(chunks.join("")));
  }
}

export class Context {
  private variableResolver: VariableResolver;
  private commandResolver: CommandResolver;
  private selectorResolver: SelectorResolver;
  private frames: Value[][] = [[]];
  result: Value = NIL;

  constructor(
    variableResolver: VariableResolver,
    commandResolver: CommandResolver,
    selectorResolver: SelectorResolver
  ) {
    this.variableResolver = variableResolver;
    this.commandResolver = commandResolver;
    this.selectorResolver = selectorResolver;
  }

  openFrame() {
    this.frames.push([]);
  }
  closeFrame() {
    return this.frames.pop();
  }
  frame() {
    return this.frames[this.frames.length - 1];
  }
  push(value: Value) {
    this.frame().push(value);
  }
  pop() {
    return this.frame().pop();
  }
  expand() {
    const last = this.frame().slice(-1)[0];
    if (last && last.type == ValueType.TUPLE) {
      this.frame().pop();
      this.frame().push(...(last as TupleValue).values);
    }
  }

  execute(operations: Operation[]): Value {
    for (let operation of operations) {
      operation.execute(this);
    }
    if (this.frame().length) this.result = this.pop();
    return this.result;
  }

  resolveValue(source: Value) {
    if (source.type == ValueType.TUPLE) {
      return this.mapTuple(source as TupleValue, (element) =>
        this.resolveValue(element)
      );
    } else {
      return this.resolveVariable(source.asString());
    }
  }
  private resolveVariable(varname: string): Value {
    let value = this.variableResolver.resolve(varname);
    if (!value) throw new Error(`cannot resolve variable ${varname}`);
    return value;
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

  resolveCommand(args: Value[]) {
    const cmdname = args[0].asString();
    const command = this.commandResolver.resolve(cmdname);
    if (!command) throw new Error(`cannot resolve command ${cmdname}`);
    return command;
  }
  resolveSelector(rules: Value[]) {
    return this.selectorResolver.resolve(rules);
  }
}
