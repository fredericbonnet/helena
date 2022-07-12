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

export enum OpCode {
  PUSH_CONSTANT,
  OPEN_FRAME,
  CLOSE_FRAME,
  RESOLVE_VALUE,
  EXPAND_VALUE,
  SET_SOURCE,
  SELECT_INDEX,
  SELECT_KEYS,
  SELECT_RULES,
  EVALUATE_SENTENCE,
  SUBSTITUTE_RESULT,
  JOIN_STRINGS,
}

export class Program {
  opCodes: OpCode[] = [];
  constants: Value[] = [];
  pushOpCode(opCode: OpCode) {
    this.opCodes.push(opCode);
  }
  pushConstant(value: Value) {
    this.constants.push(value);
  }
  empty(): boolean {
    return !this.opCodes.length;
  }
}

export class Compiler {
  private syntaxChecker: SyntaxChecker = new SyntaxChecker();

  /*
   * Scripts
   */

  compileScript(script: Script): Program {
    const program: Program = new Program();
    this.emitScript(program, script);
    if (!program.empty()) program.pushOpCode(OpCode.SUBSTITUTE_RESULT);
    return program;
  }
  private emitScript(program: Program, script: Script) {
    for (let sentence of script.sentences) {
      program.pushOpCode(OpCode.OPEN_FRAME);
      this.emitSentence(program, sentence);
      program.pushOpCode(OpCode.CLOSE_FRAME);
      program.pushOpCode(OpCode.EVALUATE_SENTENCE);
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
    program.pushOpCode(OpCode.OPEN_FRAME);
    this.emitStems(program, morphemes);
    program.pushOpCode(OpCode.CLOSE_FRAME);
    program.pushOpCode(OpCode.JOIN_STRINGS);
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
      program.pushOpCode(OpCode.RESOLVE_VALUE);
    }
    if (substitute.expansion) {
      program.pushOpCode(OpCode.EXPAND_VALUE);
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
        program.pushOpCode(OpCode.RESOLVE_VALUE);
      }
    }
  }

  /*
   * Morphemes
   */

  private emitLiteral(program: Program, literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    this.emitConstant(program, value);
  }
  private emitTuple(program: Program, tuple: TupleMorpheme) {
    program.pushOpCode(OpCode.OPEN_FRAME);
    for (let sentence of tuple.subscript.sentences) {
      this.emitSentence(program, sentence);
    }
    program.pushOpCode(OpCode.CLOSE_FRAME);
  }
  private emitBlock(program: Program, block: BlockMorpheme) {
    const value = new ScriptValue(block.subscript, block.value);
    this.emitConstant(program, value);
  }
  private emitExpression(program: Program, expression: ExpressionMorpheme) {
    this.emitScript(program, expression.subscript);
    program.pushOpCode(OpCode.SUBSTITUTE_RESULT);
  }
  private emitString(program: Program, string: StringMorpheme) {
    program.pushOpCode(OpCode.OPEN_FRAME);
    this.emitStems(program, string.morphemes);
    program.pushOpCode(OpCode.CLOSE_FRAME);
    program.pushOpCode(OpCode.JOIN_STRINGS);
  }
  private emitHereString(program: Program, string: HereStringMorpheme) {
    const value = new StringValue(string.value);
    this.emitConstant(program, value);
  }
  private emitTaggedString(program: Program, string: TaggedStringMorpheme) {
    const value = new StringValue(string.value);
    this.emitConstant(program, value);
  }
  private emitLiteralVarname(program: Program, literal: LiteralMorpheme) {
    this.emitLiteral(program, literal);
    program.pushOpCode(OpCode.RESOLVE_VALUE);
  }
  private emitTupleVarnames(program: Program, tuple: TupleMorpheme) {
    this.emitTuple(program, tuple);
    program.pushOpCode(OpCode.RESOLVE_VALUE);
  }
  private emitBlockVarname(program: Program, block: BlockMorpheme) {
    const value = new StringValue(block.value);
    this.emitConstant(program, value);
    program.pushOpCode(OpCode.RESOLVE_VALUE);
  }
  private emitLiteralSource(program: Program, literal: LiteralMorpheme) {
    this.emitLiteral(program, literal);
    program.pushOpCode(OpCode.SET_SOURCE);
  }
  private emitTupleSource(program: Program, tuple: TupleMorpheme) {
    this.emitTuple(program, tuple);
    program.pushOpCode(OpCode.SET_SOURCE);
  }
  private emitBlockSource(program: Program, block: BlockMorpheme) {
    const value = new StringValue(block.value);
    this.emitConstant(program, value);
    program.pushOpCode(OpCode.SET_SOURCE);
  }
  private emitKeyedSelector(program: Program, tuple: TupleMorpheme) {
    this.emitTuple(program, tuple);
    program.pushOpCode(OpCode.SELECT_KEYS);
  }
  private emitIndexedSelector(
    program: Program,
    expression: ExpressionMorpheme
  ) {
    this.emitScript(program, expression.subscript);
    program.pushOpCode(OpCode.SUBSTITUTE_RESULT);
    program.pushOpCode(OpCode.SELECT_INDEX);
  }
  private emitSelector(program: Program, block: BlockMorpheme) {
    program.pushOpCode(OpCode.OPEN_FRAME);
    for (let sentence of block.subscript.sentences) {
      program.pushOpCode(OpCode.OPEN_FRAME);
      this.emitSentence(program, sentence);
      program.pushOpCode(OpCode.CLOSE_FRAME);
    }
    program.pushOpCode(OpCode.CLOSE_FRAME);
    program.pushOpCode(OpCode.SELECT_RULES);
  }

  private emitConstant(program: Program, value: Value) {
    program.pushOpCode(OpCode.PUSH_CONSTANT);
    program.pushConstant(value);
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

  execute(program: Program): Value {
    let constant = 0;
    for (let opcode of program.opCodes) {
      switch (opcode) {
        case OpCode.PUSH_CONSTANT:
          this.push(program.constants[constant++]);
          break;

        case OpCode.OPEN_FRAME:
          this.openFrame();
          break;

        case OpCode.CLOSE_FRAME:
          {
            const values = this.closeFrame();
            this.push(new TupleValue(values));
          }
          break;

        case OpCode.RESOLVE_VALUE:
          {
            const source = this.pop();
            this.push(this.resolveValue(source));
          }
          break;

        case OpCode.EXPAND_VALUE:
          this.expand();
          break;

        case OpCode.SET_SOURCE:
          {
            const source = this.pop();
            this.push(new QualifiedValue(source, []));
          }
          break;

        case OpCode.SELECT_INDEX:
          {
            const index = this.pop();
            const selector = new IndexedSelector(index);
            const value = this.pop();
            this.push(selector.apply(value));
          }
          break;

        case OpCode.SELECT_KEYS:
          {
            const keys = this.pop() as TupleValue;
            const selector = new KeyedSelector(keys.values);
            const value = this.pop();
            this.push(selector.apply(value));
          }
          break;

        case OpCode.SELECT_RULES:
          {
            const rules = this.pop() as TupleValue;
            const selector = this.resolveSelector(rules.values);
            const value = this.pop();
            this.push(selector.apply(value));
          }
          break;

        case OpCode.EVALUATE_SENTENCE:
          {
            const args = this.pop() as TupleValue;
            if (args.values.length) {
              const command = this.resolveCommand(args.values);
              this.result = command.evaluate(args.values);
            }
          }
          break;

        case OpCode.SUBSTITUTE_RESULT:
          this.push(this.result);
          break;

        case OpCode.JOIN_STRINGS:
          {
            const tuple = this.pop() as TupleValue;
            const chunks = tuple.values.map((value) => value.asString());
            this.push(new StringValue(chunks.join("")));
          }
          break;
      }
    }
    if (this.frame().length) this.result = this.pop();
    return this.result;
  }

  private openFrame() {
    this.frames.push([]);
  }
  private closeFrame() {
    return this.frames.pop();
  }
  private frame() {
    return this.frames[this.frames.length - 1];
  }
  private push(value: Value) {
    this.frame().push(value);
  }
  private pop() {
    return this.frame().pop();
  }
  private last() {
    return this.frame()[this.frame().length - 1];
  }
  private expand() {
    const last = this.last();
    if (last && last.type == ValueType.TUPLE) {
      this.frame().pop();
      this.frame().push(...(last as TupleValue).values);
    }
  }
  private resolveValue(source: Value) {
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
  private resolveCommand(args: Value[]) {
    const cmdname = args[0].asString();
    const command = this.commandResolver.resolve(cmdname);
    if (!command) throw new Error(`cannot resolve command ${cmdname}`);
    return command;
  }
  private resolveSelector(rules: Value[]) {
    return this.selectorResolver.resolve(rules);
  }
}
