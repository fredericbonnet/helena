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

  /*
   * Scripts
   */

  compileScript(script: Script): Program {
    const program: Program = new Program();
    this.emitScript(program, script);
    if (!program.empty()) program.push(new SubstituteResult());
    return program;
  }
  private emitScript(program: Program, script: Script) {
    for (let sentence of script.sentences) {
      program.push(new OpenFrame());
      this.emitSentence(program, sentence);
      program.push(new CloseFrame());
      program.push(new EvaluateSentence());
    }
  }

  /*
   * Sentences
   */

  compileSentence(sentence: Sentence): Program {
    const program: Program = new Program();
    this.emitSentence(program, sentence);
    return program;
  }
  private emitSentence(program: Program, sentence: Sentence) {
    for (let word of sentence.words) {
      this.emitWord(program, word);
    }
  }

  /*
   * Words
   */

  compileWord(word: Word): Program {
    const program: Program = new Program();
    this.emitWord(program, word);
    return program;
  }

  private emitWord(program: Program, word: Word) {
    switch (this.syntaxChecker.checkWord(word)) {
      case WordType.ROOT:
        this.emitRoot(program, word.morphemes[0]);
        break;
      case WordType.COMPOUND:
        this.emitCompound(program, word.morphemes);
        break;
      case WordType.SUBSTITUTION:
        this.emitSubstitution(program, word.morphemes);
        break;
      case WordType.QUALIFIED:
        this.emitQualified(program, word.morphemes);
        break;
      case WordType.IGNORED:
        break;
      default:
        throw new Error("unknown word type");
    }
  }
  private emitRoot(program: Program, root: Morpheme) {
    switch (root.type) {
      case MorphemeType.LITERAL: {
        const literal = root as LiteralMorpheme;
        this.emitLiteral(program, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = root as TupleMorpheme;
        this.emitTuple(program, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = root as BlockMorpheme;
        this.emitBlock(program, block);
        break;
      }

      case MorphemeType.EXPRESSION: {
        const expression = root as ExpressionMorpheme;
        this.emitExpression(program, expression);
        break;
      }

      case MorphemeType.STRING: {
        const string = root as StringMorpheme;
        this.emitString(program, string);
        break;
      }

      case MorphemeType.HERE_STRING: {
        const string = root as HereStringMorpheme;
        this.emitHereString(program, string);
        break;
      }

      case MorphemeType.TAGGED_STRING: {
        const string = root as TaggedStringMorpheme;
        this.emitTaggedString(program, string);
        break;
      }

      default:
        throw new Error("unexpected morpheme");
    }
  }
  private emitCompound(program: Program, morphemes: Morpheme[]) {
    program.push(new OpenFrame());
    this.emitStems(program, morphemes);
    program.push(new CloseFrame());
    program.push(new JoinStrings());
  }
  private emitSubstitution(program: Program, morphemes: Morpheme[]) {
    const substitute = morphemes[0] as SubstituteNextMorpheme;
    const selectable = morphemes[1];
    switch (selectable.type) {
      case MorphemeType.LITERAL: {
        const literal = selectable as LiteralMorpheme;
        this.emitLiteralVarname(program, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = selectable as TupleMorpheme;
        this.emitTupleVarnames(program, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = selectable as BlockMorpheme;
        this.emitBlockVarname(program, block);
        break;
      }

      case MorphemeType.EXPRESSION: {
        const expression = selectable as ExpressionMorpheme;
        this.emitExpression(program, expression);
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
          this.emitKeyedSelector(program, tuple);
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          this.emitSelector(program, block);
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          this.emitIndexedSelector(program, expression);
          break;
        }

        default:
          throw new Error("unexpected morpheme");
      }
    }
    for (let level = 1; level < substitute.levels; level++) {
      program.push(new ResolveValue());
    }
    if (substitute.expansion) {
      program.push(new ExpandValue());
    }
  }
  private emitQualified(program: Program, morphemes: Morpheme[]) {
    const selectable = morphemes[0];
    switch (selectable.type) {
      case MorphemeType.LITERAL: {
        const literal = selectable as LiteralMorpheme;
        this.emitLiteralSource(program, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = selectable as TupleMorpheme;
        this.emitTupleSource(program, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = selectable as BlockMorpheme;
        this.emitBlockSource(program, block);
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
          this.emitKeyedSelector(program, tuple);
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          this.emitSelector(program, block);
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          this.emitIndexedSelector(program, expression);
          break;
        }

        default:
          throw new Error("unexpected morpheme");
      }
    }
  }
  private emitStems(program: Program, morphemes: Morpheme[]) {
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
            this.emitLiteralVarname(program, literal);
            mode = "selectable";
          } else {
            this.emitLiteral(program, literal);
            mode = "";
          }
          break;
        }

        case MorphemeType.TUPLE: {
          const tuple = morpheme as TupleMorpheme;
          if (mode == "selectable") {
            this.emitKeyedSelector(program, tuple);
          } else if (mode == "substitute") {
            this.emitTupleVarnames(program, tuple);
            mode = "selectable";
          } else {
            this.emitTuple(program, tuple);
            mode = "";
          }
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          if (mode == "substitute") {
            this.emitBlockVarname(program, block);
            mode = "selectable";
          } else {
            this.emitBlock(program, block);
            mode = "";
          }
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          if (mode == "selectable") {
            this.emitIndexedSelector(program, expression);
          } else if (mode == "substitute") {
            this.emitExpression(program, expression);
            mode = "selectable";
          } else {
            this.emitExpression(program, expression);
            mode = "";
          }
          break;
        }

        case MorphemeType.STRING: {
          const string = morpheme as StringMorpheme;
          this.emitString(program, string);
          break;
        }

        case MorphemeType.HERE_STRING: {
          const string = morpheme as HereStringMorpheme;
          this.emitHereString(program, string);
          break;
        }

        case MorphemeType.TAGGED_STRING: {
          const string = morpheme as TaggedStringMorpheme;
          this.emitTaggedString(program, string);
          break;
        }

        default:
          throw new Error("unknown morpheme");
      }
    }
    if (substitute) {
      for (let level = 1; level < substitute.levels; level++) {
        program.push(new ResolveValue());
      }
    }
  }

  /*
   * Morphemes
   */

  private emitLiteral(program: Program, literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    program.push(new PushValue(value));
  }
  private emitTuple(program: Program, tuple: TupleMorpheme) {
    program.push(new OpenFrame());
    for (let sentence of tuple.subscript.sentences) {
      this.emitSentence(program, sentence);
    }
    program.push(new CloseFrame());
  }
  private emitBlock(program: Program, block: BlockMorpheme) {
    const value = new ScriptValue(block.subscript, block.value);
    program.push(new PushValue(value));
  }
  private emitExpression(program: Program, expression: ExpressionMorpheme) {
    this.emitScript(program, expression.subscript);
    program.push(new SubstituteResult());
  }
  private emitString(program: Program, string: StringMorpheme) {
    program.push(new OpenFrame());
    this.emitStems(program, string.morphemes);
    program.push(new CloseFrame());
    program.push(new JoinStrings());
  }
  private emitHereString(program: Program, string: HereStringMorpheme) {
    const value = new StringValue(string.value);
    program.push(new PushValue(value));
  }
  private emitTaggedString(program: Program, string: TaggedStringMorpheme) {
    const value = new StringValue(string.value);
    program.push(new PushValue(value));
  }
  private emitLiteralVarname(program: Program, literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    program.push(new PushValue(value));
    program.push(new ResolveValue());
  }
  private emitTupleVarnames(program: Program, tuple: TupleMorpheme) {
    this.emitTuple(program, tuple);
    program.push(new ResolveValue());
  }
  private emitBlockVarname(program: Program, block: BlockMorpheme) {
    const value = new StringValue(block.value);
    program.push(new PushValue(value));
    program.push(new ResolveValue());
  }
  private emitLiteralSource(program: Program, literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    program.push(new PushValue(value));
    program.push(new SetSource());
  }
  private emitTupleSource(program: Program, tuple: TupleMorpheme) {
    this.emitTuple(program, tuple);
    program.push(new SetSource());
  }
  private emitBlockSource(program: Program, block: BlockMorpheme) {
    const value = new StringValue(block.value);
    program.push(new PushValue(value));
    program.push(new SetSource());
  }
  private emitKeyedSelector(program: Program, tuple: TupleMorpheme) {
    this.emitTuple(program, tuple);
    program.push(new SelectKeys());
  }
  private emitIndexedSelector(
    program: Program,
    expression: ExpressionMorpheme
  ) {
    this.emitScript(program, expression.subscript);
    program.push(new SubstituteResult());
    program.push(new SelectIndex());
  }
  private emitSelector(program: Program, block: BlockMorpheme) {
    program.push(new OpenFrame());
    for (let sentence of block.subscript.sentences) {
      program.push(new OpenFrame());
      this.emitSentence(program, sentence);
      program.push(new CloseFrame());
    }
    program.push(new CloseFrame());
    program.push(new SelectRules());
  }
}

export interface Operation {
  execute(context: Context);
}
export class Program {
  operations: Operation[] = [];
  push(operation: Operation) {
    this.operations.push(operation);
  }
  empty(): boolean {
    return !this.operations.length;
  }
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

  execute(program: Program): Value {
    for (let operation of program.operations) {
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
