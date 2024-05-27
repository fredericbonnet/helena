/**
 * @file Helena script compilation
 */

import { ERROR, OK, Result, ResultCode } from "./results";
import { Command } from "./command";
import {
  CommandResolver,
  SelectorResolver,
  VariableResolver,
} from "./resolvers";
import { IndexedSelector, KeyedSelector, Selector } from "./selectors";
import {
  BlockMorpheme,
  ExpressionMorpheme,
  HereStringMorpheme,
  InvalidWordStructureError,
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
  UnexpectedMorphemeError,
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
  applySelector,
} from "./values";
import { displayList } from "./display";
import { SourcePosition } from "./tokenizer";

/** Supported compiler opcodes */
export enum OpCode {
  PUSH_NIL,
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
  PUSH_RESULT,
  JOIN_STRINGS,
  MAKE_TUPLE,
}

/**
 * Helena program
 */
export class Program {
  /** Sequence of opcodes the program is made of */
  readonly opCodes: OpCode[];

  /** Constants the opcodes refer to */
  readonly constants: Value[];

  /** Opcode positions */
  readonly opCodePositions: SourcePosition[];

  /* eslint-disable jsdoc/require-jsdoc */
  constructor(capturePositions = false) {
    this.opCodes = [];
    this.constants = [];
    if (capturePositions) {
      this.opCodePositions = [];
    }
  }
  /* eslint-enable jsdoc/require-jsdoc */

  /**
   * Push a new opcode
   *
   * @param opCode     - Opcode to add
   * @param [position] - Position in source
   */
  pushOpCode(opCode: OpCode, position?: SourcePosition) {
    this.opCodes.push(opCode);
    if (this.opCodePositions) this.opCodePositions.push(position);
  }
  /**
   * Push a new constant
   *
   * @param value - Constant to add
   */
  pushConstant(value: Value) {
    this.constants.push(value);
  }

  /**
   * Predicate telling whether the program is empty
   *
   * @returns Whether the program is empty
   */
  empty(): boolean {
    return !this.opCodes.length;
  }
}

/**
 * Compiler options
 */
export type CompilerOptions = {
  /** Whether to capture opcode and constant positions */
  capturePositions?: boolean;
};

/**
 * Helena compiler
 *
 * This class transforms scripts, sentences and words into programs
 */
export class Compiler {
  /** Syntax checker used during compilation */
  private readonly syntaxChecker: SyntaxChecker;

  /** Compiler options */
  private readonly options: CompilerOptions;

  /* eslint-disable jsdoc/require-jsdoc */
  constructor(options: CompilerOptions = { capturePositions: false }) {
    this.syntaxChecker = new SyntaxChecker();
    this.options = options;
  }
  /* eslint-enable jsdoc/require-jsdoc */

  /*
   * Scripts
   */

  /**
   * Compile the given script into a program
   *
   * @param script - Script to compile
   *
   * @returns        Compiled program
   */
  compileScript(script: Script): Program {
    const program: Program = new Program(this.options.capturePositions);
    if (script.sentences.length == 0) return program;
    this.emitScript(program, script);
    return program;
  }
  private emitScript(program: Program, script: Script) {
    if (script.sentences.length == 0) {
      program.pushOpCode(OpCode.PUSH_NIL, script.position);
      return;
    }
    for (const sentence of script.sentences) {
      program.pushOpCode(OpCode.OPEN_FRAME, sentence.position);
      this.emitSentence(program, sentence);
      program.pushOpCode(OpCode.CLOSE_FRAME, sentence.position);
      program.pushOpCode(OpCode.EVALUATE_SENTENCE, sentence.position);
    }
    program.pushOpCode(OpCode.PUSH_RESULT, script.position);
  }

  /*
   * Sentences
   */

  /**
   * Flatten and compile the given sentences into a program
   *
   * @param sentences - Sentences to compile
   *
   * @returns           Compiled program
   */
  compileSentences(sentences: Sentence[]): Program {
    const program: Program = new Program(this.options.capturePositions);
    this.emitSentences(program, sentences);
    program.pushOpCode(OpCode.MAKE_TUPLE);
    return program;
  }
  private emitSentences(
    program: Program,
    sentences: Sentence[],
    position?: SourcePosition
  ) {
    program.pushOpCode(OpCode.OPEN_FRAME, position);
    for (const sentence of sentences) {
      this.emitSentence(program, sentence);
    }
    program.pushOpCode(OpCode.CLOSE_FRAME, position);
  }

  /**
   * Compile the given sentence into a program
   *
   * @param sentence - Sentence to compile
   *
   * @returns          Compiled program
   */
  compileSentence(sentence: Sentence): Program {
    const program: Program = new Program(this.options.capturePositions);
    this.emitSentence(program, sentence);
    return program;
  }
  private emitSentence(program: Program, sentence: Sentence) {
    for (const word of sentence.words) {
      if (word instanceof Word) {
        this.emitWord(program, word);
      } else {
        this.emitConstant(program, word);
      }
    }
  }

  /*
   * Words
   */

  /**
   * Compile the given word into a program
   *
   * @param word - Word to compile
   *
   * @returns      Compiled program
   */
  compileWord(word: Word): Program {
    const program: Program = new Program(this.options.capturePositions);
    this.emitWord(program, word);
    return program;
  }

  /**
   * Compile the given constant value into a program
   *
   * @param value - Constant to compile
   *
   * @returns       Compiled program
   */
  compileConstant(value: Value): Program {
    const program: Program = new Program();
    this.emitConstant(program, value);
    return program;
  }

  private emitWord(program: Program, word: Word) {
    switch (this.syntaxChecker.checkWord(word)) {
      case WordType.ROOT:
        this.emitRoot(program, word);
        break;
      case WordType.COMPOUND:
        this.emitCompound(program, word);
        break;
      case WordType.SUBSTITUTION:
        this.emitSubstitution(program, word);
        break;
      case WordType.QUALIFIED:
        this.emitQualified(program, word);
        break;
      case WordType.IGNORED:
        break;
      case WordType.INVALID:
        throw new InvalidWordStructureError("invalid word structure");
      default:
        throw new Error("CANTHAPPEN");
    }
  }
  private emitRoot(program: Program, word: Word) {
    const root = word.morphemes[0];
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
        throw new UnexpectedMorphemeError("unexpected morpheme");
    }
  }
  private emitCompound(program: Program, word: Word) {
    program.pushOpCode(OpCode.OPEN_FRAME, word.position);
    this.emitStems(program, word.morphemes);
    program.pushOpCode(OpCode.CLOSE_FRAME, word.position);
    program.pushOpCode(OpCode.JOIN_STRINGS, word.position);
  }
  private emitSubstitution(program: Program, word: Word) {
    const firstSubstitute = 0;
    const expand = (word.morphemes[0] as SubstituteNextMorpheme).expansion;
    let levels = 1;
    let i = 1;
    while (word.morphemes[i].type == MorphemeType.SUBSTITUTE_NEXT) {
      i++;
      levels++;
    }
    const selectable = word.morphemes[i++];
    switch (selectable.type) {
      case MorphemeType.LITERAL: {
        const literal = selectable as LiteralMorpheme;
        const substitute = word.morphemes[firstSubstitute + levels - 1];
        this.emitLiteral(program, literal);
        program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = selectable as TupleMorpheme;
        const substitute = word.morphemes[firstSubstitute + levels - 1];
        this.emitTuple(program, tuple);
        program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = selectable as BlockMorpheme;
        const substitute = word.morphemes[firstSubstitute + levels - 1];
        this.emitBlockString(program, block);
        program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
        break;
      }

      case MorphemeType.EXPRESSION: {
        const expression = selectable as ExpressionMorpheme;
        this.emitExpression(program, expression);
        break;
      }

      default:
        throw new UnexpectedMorphemeError("unexpected morpheme");
    }
    while (i < word.morphemes.length) {
      const morpheme = word.morphemes[i++];
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
          throw new UnexpectedMorphemeError("unexpected morpheme");
      }
    }
    this.terminateSubstitutionSequence(
      program,
      word.morphemes,
      firstSubstitute,
      levels
    );
    if (expand) {
      program.pushOpCode(OpCode.EXPAND_VALUE, word.position);
    }
  }
  private emitQualified(program: Program, word: Word) {
    const selectable = word.morphemes[0];
    switch (selectable.type) {
      case MorphemeType.LITERAL: {
        const literal = selectable as LiteralMorpheme;
        this.emitLiteral(program, literal);
        break;
      }

      case MorphemeType.TUPLE: {
        const tuple = selectable as TupleMorpheme;
        this.emitTuple(program, tuple);
        break;
      }

      case MorphemeType.BLOCK: {
        const block = selectable as BlockMorpheme;
        this.emitBlockString(program, block);
        break;
      }

      default:
        throw new UnexpectedMorphemeError("unexpected morpheme");
    }
    program.pushOpCode(OpCode.SET_SOURCE, selectable.position);
    for (let i = 1; i < word.morphemes.length; i++) {
      const morpheme = word.morphemes[i];
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
          throw new UnexpectedMorphemeError("unexpected morpheme");
      }
    }
  }
  private emitStems(program: Program, morphemes: Morpheme[]) {
    let mode: "" | "substitute" | "selectable" = "";
    let firstSubstitute;
    let levels;
    for (let i = 0; i < morphemes.length; i++) {
      const morpheme = morphemes[i];
      if (mode == "selectable") {
        switch (morpheme.type) {
          case MorphemeType.SUBSTITUTE_NEXT:
          case MorphemeType.LITERAL:
            this.terminateSubstitutionSequence(
              program,
              morphemes,
              firstSubstitute,
              levels
            );
            mode = "";
        }
      }

      switch (mode) {
        case "substitute": {
          switch (morpheme.type) {
            case MorphemeType.SUBSTITUTE_NEXT:
              // Continue substitution sequence
              levels++;
              continue;

            // Expecting a source (varname or expression)
            case MorphemeType.LITERAL: {
              const literal = morpheme as LiteralMorpheme;
              const substitute = morphemes[firstSubstitute + levels - 1];
              this.emitLiteral(program, literal);
              program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
              break;
            }

            case MorphemeType.TUPLE: {
              const tuple = morpheme as TupleMorpheme;
              const substitute = morphemes[firstSubstitute + levels - 1];
              this.emitTuple(program, tuple);
              program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
              break;
            }

            case MorphemeType.BLOCK: {
              const block = morpheme as BlockMorpheme;
              const substitute = morphemes[firstSubstitute + levels - 1];
              this.emitBlockString(program, block);
              program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
              break;
            }

            case MorphemeType.EXPRESSION: {
              const expression = morpheme as ExpressionMorpheme;
              this.emitExpression(program, expression);
              break;
            }

            default:
              throw new UnexpectedMorphemeError("unexpected morpheme");
          }
          mode = "selectable";
          break;
        }

        case "selectable": {
          // Expecting a selector
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
              throw new UnexpectedMorphemeError("unexpected morpheme");
          }
          break;
        }

        default: {
          switch (morpheme.type) {
            case MorphemeType.SUBSTITUTE_NEXT:
              // Start substitution sequence
              mode = "substitute";
              firstSubstitute = i;
              levels = 1;
              break;

            case MorphemeType.LITERAL: {
              const literal = morpheme as LiteralMorpheme;
              this.emitLiteral(program, literal);
              break;
            }

            case MorphemeType.EXPRESSION: {
              const expression = morpheme as ExpressionMorpheme;
              this.emitExpression(program, expression);
              break;
            }

            default:
              throw new UnexpectedMorphemeError("unexpected morpheme");
          }
        }
      }
    }
    if (mode == "selectable") {
      this.terminateSubstitutionSequence(
        program,
        morphemes,
        firstSubstitute,
        levels
      );
    }
  }
  private terminateSubstitutionSequence(
    program: Program,
    morphemes: Morpheme[],
    first: number,
    levels: number
  ) {
    for (let level = levels - 1; level >= 1; level--) {
      const substitute = morphemes[first + level - 1];
      program.pushOpCode(OpCode.RESOLVE_VALUE, substitute.position);
    }
  }

  /*
   * Morphemes
   */

  private emitLiteral(program: Program, literal: LiteralMorpheme) {
    const value = new StringValue(literal.value);
    this.emitConstant(program, value, literal.position);
  }
  private emitTuple(program: Program, tuple: TupleMorpheme) {
    this.emitSentences(program, tuple.subscript.sentences, tuple.position);
    program.pushOpCode(OpCode.MAKE_TUPLE, tuple.position);
  }
  private emitBlock(program: Program, block: BlockMorpheme) {
    const value = new ScriptValue(block.subscript, block.value);
    this.emitConstant(program, value, block.position);
  }
  private emitBlockString(program: Program, block: BlockMorpheme) {
    const value = new StringValue(block.value);
    this.emitConstant(program, value, block.position);
  }
  private emitExpression(program: Program, expression: ExpressionMorpheme) {
    this.emitScript(program, expression.subscript);
  }
  private emitString(program: Program, string: StringMorpheme) {
    program.pushOpCode(OpCode.OPEN_FRAME, string.position);
    this.emitStems(program, string.morphemes);
    program.pushOpCode(OpCode.CLOSE_FRAME, string.position);
    program.pushOpCode(OpCode.JOIN_STRINGS, string.position);
  }
  private emitHereString(program: Program, string: HereStringMorpheme) {
    const value = new StringValue(string.value);
    this.emitConstant(program, value, string.position);
  }
  private emitTaggedString(program: Program, string: TaggedStringMorpheme) {
    const value = new StringValue(string.value);
    this.emitConstant(program, value, string.position);
  }
  private emitKeyedSelector(program: Program, tuple: TupleMorpheme) {
    this.emitSentences(program, tuple.subscript.sentences, tuple.position);
    program.pushOpCode(OpCode.SELECT_KEYS, tuple.position);
  }
  private emitIndexedSelector(
    program: Program,
    expression: ExpressionMorpheme
  ) {
    this.emitScript(program, expression.subscript);
    program.pushOpCode(OpCode.SELECT_INDEX, expression.position);
  }
  private emitSelector(program: Program, block: BlockMorpheme) {
    program.pushOpCode(OpCode.OPEN_FRAME, block.position);
    for (const sentence of block.subscript.sentences) {
      program.pushOpCode(OpCode.OPEN_FRAME, sentence.position);
      this.emitSentence(program, sentence);
      program.pushOpCode(OpCode.CLOSE_FRAME, sentence.position);
      program.pushOpCode(OpCode.MAKE_TUPLE, sentence.position);
    }
    program.pushOpCode(OpCode.CLOSE_FRAME, block.position);
    program.pushOpCode(OpCode.SELECT_RULES, block.position);
  }

  private emitConstant(
    program: Program,
    value: Value,
    position?: SourcePosition
  ) {
    program.pushOpCode(OpCode.PUSH_CONSTANT, position);
    program.pushConstant(value);
  }
}

/**
 * Helena program state
 *
 * This class encapsulates the state of a program being executed, allowing
 * reentrancy and parallelism of executors
 */
export class ProgramState {
  /** Execution stack */
  private readonly stack: Value[] = [];

  /** Execution frame start indexes; each frame is a slice of the stack */
  private readonly frames: number[] = [0];

  /** Last closed frame */
  lastFrame: Value[] = undefined;

  /** Program counter */
  pc = 0;

  /** Constant counter */
  cc = 0;

  /** Last executed command */
  command: Command;

  /** Last executed result value */
  result: Result = OK(NIL);

  /** Open a new frame */
  openFrame() {
    this.frames.push(this.stack.length);
  }

  /**
   * Close the current frame
   */
  closeFrame() {
    const length = this.frames.pop();
    this.lastFrame = this.stack.splice(length);
  }

  /** @returns Whether current frame is empty */
  empty(): boolean {
    return this.frames[this.frames.length - 1] == this.stack.length;
  }

  /**
   * Push value on current frame
   *
   * @param value - Value to push
   */
  push(value: Value) {
    this.stack.push(value);
  }

  /**
   * Pop last value on current frame
   *
   * @returns Popped value
   */
  pop() {
    return this.stack.pop();
  }

  /** @returns Last value on current frame */
  private last() {
    return this.stack[this.stack.length - 1];
  }

  /** Expand last value in current frame */
  expand() {
    const last = this.last();
    if (last && last.type == ValueType.TUPLE) {
      this.stack.pop();
      this.stack.push(...(last as TupleValue).values);
    }
  }
}

/**
 * Helena program executor
 *
 * This class executes compiled programs in an isolated state
 */
export class Executor {
  /** Variable resolver used during execution */
  private readonly variableResolver: VariableResolver;

  /** Command resolver used during execution */
  private readonly commandResolver: CommandResolver;

  /** Selector resolver used during execution */
  private readonly selectorResolver: SelectorResolver;

  /** Opaque context passed to commands */
  private readonly context: unknown;

  /**
   * @param variableResolver - Variable resolver
   * @param commandResolver  - Command resolver
   * @param selectorResolver - Selector resolver
   * @param [context]        - Opaque context
   */
  constructor(
    variableResolver: VariableResolver,
    commandResolver: CommandResolver,
    selectorResolver: SelectorResolver,
    context?: unknown
  ) {
    this.variableResolver = variableResolver;
    this.commandResolver = commandResolver;
    this.selectorResolver = selectorResolver;
    this.context = context;
  }

  /**
   * Execute the given program
   *
   * Runs a flat loop over the program opcodes
   *
   * By default a new state is created at each call. Passing a state object
   * can be used to implement resumability, context switching, trampolines,
   * coroutines, etc.
   *
   * @param program - Program to execute
   * @param [state] - Program state (defaults to new)
   *
   * @returns         Last executed result
   */
  execute(program: Program, state = new ProgramState()): Result {
    if (state.result.code == ResultCode.YIELD && state.command?.resume) {
      state.result = state.command.resume(state.result, this.context);
      if (state.result.code != ResultCode.OK) return state.result;
    }
    while (state.pc < program.opCodes.length) {
      const opcode = program.opCodes[state.pc++];
      switch (opcode) {
        case OpCode.PUSH_NIL:
          state.push(NIL);
          break;

        case OpCode.PUSH_CONSTANT:
          state.push(program.constants[state.cc++]);
          break;

        case OpCode.OPEN_FRAME:
          state.openFrame();
          break;

        case OpCode.CLOSE_FRAME:
          state.closeFrame();
          break;

        case OpCode.RESOLVE_VALUE:
          {
            const source = state.pop();
            const result = this.resolveValue(source);
            if (result.code != ResultCode.OK) return result;
            state.push(result.value);
          }
          break;

        case OpCode.EXPAND_VALUE:
          state.expand();
          break;

        case OpCode.SET_SOURCE:
          {
            const source = state.pop();
            state.push(new QualifiedValue(source, []));
          }
          break;

        case OpCode.SELECT_INDEX:
          {
            const index = state.pop();
            const value = state.pop();
            const { data: selector, ...result2 } =
              IndexedSelector.create(index);
            if (result2.code != ResultCode.OK) return result2;
            const result = selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            state.push(result.value);
          }
          break;

        case OpCode.SELECT_KEYS:
          {
            const keys = state.lastFrame;
            const value = state.pop();
            const { data: selector, ...result2 } = KeyedSelector.create(keys);
            if (result2.code != ResultCode.OK) return result2;
            const result = selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            state.push(result.value);
          }
          break;

        case OpCode.SELECT_RULES:
          {
            const rules = state.lastFrame;
            const value = state.pop();
            const { data: selector, ...result } = this.resolveSelector(rules);
            if (result.code != ResultCode.OK) return result;
            const result2 = applySelector(value, selector);
            if (result2.code != ResultCode.OK) return result2;
            state.push(result2.value);
          }
          break;

        case OpCode.EVALUATE_SENTENCE:
          {
            const args = state.lastFrame;
            if (args.length) {
              const cmdname = args[0];
              const { data: command, ...result } = this.resolveCommand(cmdname);
              if (result.code != ResultCode.OK) return result;
              state.command = command;
              state.result = state.command.execute(args, this.context);
              if (state.result.code != ResultCode.OK) return state.result;
            }
          }
          break;

        case OpCode.PUSH_RESULT:
          state.push(state.result.value);
          break;

        case OpCode.JOIN_STRINGS:
          {
            const values = state.lastFrame;
            let s = "";
            for (const value of values) {
              const { data, ...result } = StringValue.toString(value);
              if (result.code != ResultCode.OK) return result;
              s += data;
            }
            state.push(new StringValue(s));
          }
          break;

        case OpCode.MAKE_TUPLE:
          state.push(new TupleValue(state.lastFrame));
          break;

        default:
          throw new Error("CANTHAPPEN");
      }
    }
    if (!state.empty()) state.result = OK(state.pop());
    return state.result;
  }

  /**
   * Transform the given program into a callable function
   *
   * The program is first translated into JS code then wrapped into a function
   * with all the dependencies injected as parameters. The resulting function
   * is itself curried with the current executor context.
   *
   * @param program - Program to translate
   * @returns         Resulting function
   */
  functionify(program: Program): (state?: ProgramState) => Result {
    const translator = new Translator();
    const source = translator.translate(program);
    const imports = {
      ResultCode,
      OK,
      ERROR,
      NIL,
      StringValue,
      TupleValue,
      QualifiedValue,
      IndexedSelector,
      KeyedSelector,
      applySelector,
    };
    const importsCode = `
    const {
      ResultCode,
      OK,
      ERROR,
      NIL,
      StringValue,
      TupleValue,
      QualifiedValue,
      IndexedSelector,
      KeyedSelector,
      applySelector,
    } = imports;
    `;

    const f = new Function(
      "state",
      "resolver",
      "context",
      "constants",
      "imports",
      importsCode + source
    );
    return (state = new ProgramState()) =>
      f(state, this, this.context, program.constants, imports);
  }

  /**
   * Resolve value
   *
   * - If source value is a tuple, resolve each of its elements recursively
   * - If source value is a qualified word, resolve source and apply selectors
   * - Else, resolve variable from the source string value
   *
   * @param source - Value(s) to resolve
   * @returns        Resolved value(s)
   */
  private resolveValue(source: Value): Result {
    switch (source.type) {
      case ValueType.TUPLE:
        return this.resolveTuple(source as TupleValue);
      case ValueType.QUALIFIED:
        return this.resolveQualified(source as QualifiedValue);
      default: {
        const { data: varname, code } = StringValue.toString(source);
        if (code != ResultCode.OK) return ERROR("invalid variable name");
        return this.resolveVariable(varname);
      }
    }
  }
  private resolveQualified(qualified: QualifiedValue): Result {
    let result = this.resolveValue(qualified.source);
    if (result.code != ResultCode.OK) return result;
    for (const selector of qualified.selectors) {
      result = selector.apply(result.value);
      if (result.code != ResultCode.OK) return result;
    }
    return result;
  }

  /**
   * Resolve tuple values recursively
   *
   * @param tuple - Tuple to resolve
   *
   * @returns       Resolved tuple
   */
  private resolveTuple(tuple: TupleValue): Result {
    const values: Value[] = [];
    for (const value of tuple.values) {
      let result: Result;
      switch (value.type) {
        case ValueType.TUPLE:
          result = this.resolveTuple(value as TupleValue);
          break;
        default:
          result = this.resolveValue(value);
      }
      if (result.code != ResultCode.OK) return result;
      values.push(result.value);
    }
    return OK(new TupleValue(values));
  }

  private resolveVariable(varname: string): Result {
    if (!this.variableResolver) return ERROR("no variable resolver");
    const value = this.variableResolver.resolve(varname);
    if (!value) return ERROR(`cannot resolve variable "${varname}"`);
    return OK(value);
  }
  private resolveCommand(cmdname: Value): Result<Command> {
    if (!this.commandResolver) return ERROR("no command resolver");
    const command = this.commandResolver.resolve(cmdname);
    if (!command) {
      const { data: name, code } = StringValue.toString(cmdname);
      if (code != ResultCode.OK) return ERROR("invalid command name");
      return ERROR(`cannot resolve command "${name}"`);
    }
    return OK(NIL, command);
  }
  private resolveSelector(rules: Value[]): Result<Selector> {
    if (!this.selectorResolver) return ERROR("no selector resolver");
    const result = this.selectorResolver.resolve(rules);
    if (result.code != ResultCode.OK) return result;
    if (!result.data)
      return ERROR(`cannot resolve selector {${displayList(rules)}}`);
    return result;
  }
}

/**
 * Helena program translator
 *
 * This class translates compiled programs into JavaScript code
 */
export class Translator {
  /**
   * Translate the given program
   *
   * Runs a flat loop over the program opcodes and generates JS code of each
   * opcode in sequence; constants are inlined in the order they are encountered
   *
   * Resumability is implemented using `switch` as a jump table (similar to
   * `Duff's device technique):
   *
   * - translated opcodes are wrapped into a `switch` statement whose control
   * variable is the current {@link ProgramState.pc}
   * - each opcode is behind a case statement whose value is the opcode position
   * - case statements fall through (there is no break statement)
   *
   * This allows a resumed program to jump directly to the current
   * {@link ProgramState.pc} and continue execution from there until the next
   * `return`.
   *
   * @see Executor.execute(): The generated code must be kept in sync with the
   * execution loop
   *
   * @param program - Program to execute
   *
   * @returns         Translated code
   */
  translate(program: Program) {
    const sections: string[] = [];

    sections.push(`
    if (state.result.code == ResultCode.YIELD && state.command?.resume) {
      state.result = state.command.resume(state.result, context);
      if (state.result.code != ResultCode.OK) return state.result;
    }
    `);

    sections.push(`
    switch (state.pc) {
    `);
    let pc = 0;
    let cc = 0;
    while (pc < program.opCodes.length) {
      sections.push(`
      case ${pc}: state.pc++;
      `);
      const opcode = program.opCodes[pc++];
      switch (opcode) {
        case OpCode.PUSH_NIL:
          sections.push(`
          state.push(NIL);
          `);
          break;

        case OpCode.PUSH_CONSTANT:
          sections.push(`
          state.push(constants[${cc++}]);
          `);
          break;

        case OpCode.OPEN_FRAME:
          sections.push(`
          state.openFrame();
          `);
          break;

        case OpCode.CLOSE_FRAME:
          sections.push(`
          state.closeFrame();
          `);
          break;

        case OpCode.RESOLVE_VALUE:
          sections.push(`
          {
            const source = state.pop();
            const result = resolver.resolveValue(source);
            if (result.code != ResultCode.OK) return result;
            state.push(result.value);
          }
          `);
          break;

        case OpCode.EXPAND_VALUE:
          sections.push(`
          state.expand();
          `);
          break;

        case OpCode.SET_SOURCE:
          sections.push(`
          {
            const source = state.pop();
            state.push(new QualifiedValue(source, []));
          }
          `);
          break;

        case OpCode.SELECT_INDEX:
          sections.push(`
          {
            const index = state.pop();
            const value = state.pop();
            const { data: selector, ...result2 } =
              IndexedSelector.create(index);
            const result = selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            state.push(result.value);
          }
          `);
          break;

        case OpCode.SELECT_KEYS:
          sections.push(`
          {
            const keys = state.lastFrame;
            const value = state.pop();
            const { data: selector, ...result2 } = KeyedSelector.create(keys);
            if (result2.code != ResultCode.OK) return result2;
            const result = selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            state.push(result.value);
          }
          `);
          break;

        case OpCode.SELECT_RULES:
          sections.push(`
          {
            const rules = state.lastFrame;
            const value = state.pop();
            const { data: selector, ...result } = resolver.resolveSelector(rules);
            if (result.code != ResultCode.OK) return result;
            const result2 = applySelector(value, selector);
            if (result2.code != ResultCode.OK) return result2;
            state.push(result2.value);
          }
          `);
          break;

        case OpCode.EVALUATE_SENTENCE:
          sections.push(`
          {
            const args = state.lastFrame;
            if (args.length) {
              const cmdname = args[0];
              const { data: command, ...result } = resolver.resolveCommand(cmdname);
              if (result.code != ResultCode.OK) return result;
              state.command = command;
              state.result = state.command.execute(args, context);
              if (state.result.code != ResultCode.OK) return state.result;
            }
          }
          `);
          break;

        case OpCode.PUSH_RESULT:
          sections.push(`
          state.push(state.result.value);
          `);
          break;

        case OpCode.JOIN_STRINGS:
          sections.push(`
          {
            const values = state.lastFrame;
            let s = "";
            for (const value of values) {
              const { data, ...result } = StringValue.toString(value);
              if (result.code != ResultCode.OK) return result;
              s += data;
            }
            state.push(new StringValue(s));
          }
          `);
          break;

        case OpCode.MAKE_TUPLE:
          sections.push(`
            state.push(new TupleValue(state.lastFrame));
            `);
          break;

        default:
          throw new Error("CANTHAPPEN");
      }
    }
    sections.push(`
    }
    if (!state.empty()) state.result = OK(state.pop());
    return state.result;
    `);
    return sections.join("\n");
  }
}
