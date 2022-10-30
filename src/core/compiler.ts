/**
 * @file Helena script compilation
 */

import { Command, ERROR, OK, Result, ResultCode } from "./command";
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
}

/**
 * Helena program
 */
export class Program {
  /** Sequence of opcodes the program is made of */
  readonly opCodes: OpCode[] = [];

  /** Constants the opcodes refer to */
  readonly constants: Value[] = [];

  /**
   * Push a new opcode
   *
   * @param opCode - Opcode to add
   */
  pushOpCode(opCode: OpCode) {
    this.opCodes.push(opCode);
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
 * Helena compiler
 *
 * This class transforms scripts, sentences and words into programs
 */
export class Compiler {
  /** Syntax checker used during compilation */
  private readonly syntaxChecker: SyntaxChecker = new SyntaxChecker();

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
    const program: Program = new Program();
    if (script.sentences.length == 0) return program;
    this.emitScript(program, script);
    return program;
  }
  private emitScript(program: Program, script: Script) {
    if (script.sentences.length == 0) {
      program.pushOpCode(OpCode.PUSH_NIL);
      return;
    }
    for (const sentence of script.sentences) {
      program.pushOpCode(OpCode.OPEN_FRAME);
      this.emitSentence(program, sentence);
      program.pushOpCode(OpCode.CLOSE_FRAME);
      program.pushOpCode(OpCode.EVALUATE_SENTENCE);
    }
    program.pushOpCode(OpCode.PUSH_RESULT);
  }

  /*
   * Sentences
   */

  /**
   * Compile the given sentence into a program
   *
   * @param sentence - Sentence to compile
   *
   * @returns          Compiled program
   */
  compileSentence(sentence: Sentence): Program {
    const program: Program = new Program();
    this.emitSentence(program, sentence);
    return program;
  }
  private emitSentence(program: Program, sentence: Sentence) {
    for (const word of sentence.words) {
      this.emitWord(program, word);
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
   * @returns      Compile program
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
      case WordType.INVALID:
        throw new Error("invalid word structure");
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
    for (const morpheme of morphemes) {
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
    for (const sentence of tuple.subscript.sentences) {
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
    program.pushOpCode(OpCode.SELECT_INDEX);
  }
  private emitSelector(program: Program, block: BlockMorpheme) {
    program.pushOpCode(OpCode.OPEN_FRAME);
    for (const sentence of block.subscript.sentences) {
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

/**
 * Helena process
 *
 * This class encapsulates the state of a program being executed, allowing
 * reentrancy and parallelism of executors
 */
export class Process {
  /** Execution frames; each frame is a stack of values */
  private readonly frames: Value[][] = [[]];

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
    this.frames.push([]);
  }

  /**
   * Close the current frame
   *
   * @returns The closed frame
   */
  closeFrame() {
    return this.frames.pop();
  }

  /** @returns Current frame */
  frame() {
    return this.frames[this.frames.length - 1];
  }

  /**
   * Push value on current frame
   *
   * @param value - Value to push
   */
  push(value: Value) {
    this.frame().push(value);
  }

  /**
   * Pop last value on current frame
   *
   * @returns Popped value
   */
  pop() {
    return this.frame().pop();
  }

  /** @returns Last value on current frame */
  last() {
    return this.frame()[this.frame().length - 1];
  }

  /** Expand last value in current frame */
  expand() {
    const last = this.last();
    if (last && last.type == ValueType.TUPLE) {
      this.frame().pop();
      this.frame().push(...(last as TupleValue).values);
    }
  }
}

/**
 * Helena program executor
 *
 * This class executes compiled programs in a provided process
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
   * By default a new process is created at each call. Passing a process object
   * can be used to implement resumability, context switching, trampolines,
   * coroutines, etc.
   *
   * @param program   - Program to execute
   * @param [process] - Program execution process (defaults to new)
   *
   * @returns           Last executed result
   */
  execute(program: Program, process = new Process()): Result {
    if (process.result.code == ResultCode.YIELD && process.command?.resume) {
      process.result = process.command.resume(process.result, this.context);
      if (process.result.code != ResultCode.OK) return process.result;
    }
    while (process.pc < program.opCodes.length) {
      const opcode = program.opCodes[process.pc++];
      switch (opcode) {
        case OpCode.PUSH_NIL:
          process.push(NIL);
          break;

        case OpCode.PUSH_CONSTANT:
          process.push(program.constants[process.cc++]);
          break;

        case OpCode.OPEN_FRAME:
          process.openFrame();
          break;

        case OpCode.CLOSE_FRAME:
          {
            const values = process.closeFrame();
            process.push(new TupleValue(values));
          }
          break;

        case OpCode.RESOLVE_VALUE:
          {
            const source = process.pop();
            const result = this.resolveValue(source);
            if (result.code != ResultCode.OK) return result;
            process.push(result.value);
          }
          break;

        case OpCode.EXPAND_VALUE:
          process.expand();
          break;

        case OpCode.SET_SOURCE:
          {
            const source = process.pop();
            process.push(new QualifiedValue(source, []));
          }
          break;

        case OpCode.SELECT_INDEX:
          {
            const index = process.pop();
            const selector = new IndexedSelector(index);
            const value = process.pop();
            const result = selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            process.push(result.value);
          }
          break;

        case OpCode.SELECT_KEYS:
          {
            const keys = process.pop() as TupleValue;
            const selector = new KeyedSelector(keys.values);
            const value = process.pop();
            const result = selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            process.push(result.value);
          }
          break;

        case OpCode.SELECT_RULES:
          {
            const rules = process.pop() as TupleValue;
            const selector = this.resolveSelector(rules.values);
            const value = process.pop();
            const result = value.select
              ? value.select(selector)
              : selector.apply(value);
            if (result.code != ResultCode.OK) return result;
            process.push(result.value);
          }
          break;

        case OpCode.EVALUATE_SENTENCE:
          {
            const args = process.pop() as TupleValue;
            if (args.values.length) {
              const cmdname = args.values[0];
              const command = this.resolveCommand(cmdname);
              if (!command)
                return ERROR(`cannot resolve command ${cmdname.asString()}`);
              process.command = command;
              process.result = process.command.execute(
                args.values,
                this.context
              );
              if (process.result.code != ResultCode.OK) return process.result;
            }
          }
          break;

        case OpCode.PUSH_RESULT:
          process.push(process.result.value);
          break;

        case OpCode.JOIN_STRINGS:
          {
            const tuple = process.pop() as TupleValue;
            const chunks = tuple.values.map((value) => value.asString());
            process.push(new StringValue(chunks.join("")));
          }
          break;

        default:
          throw new Error("CANTHAPPEN");
      }
    }
    if (process.frame().length) process.result = OK(process.pop());
    return process.result;
  }

  /**
   * Resolve value
   *
   * - If source value is a tuple, resolve each of its elements recursively
   * - Else, resolve variable from the source string value
   *
   * @param source - Value(s) to resolve
   * @returns        Resolved value(s)
   */
  private resolveValue(source: Value): Result {
    if (source.type == ValueType.TUPLE) {
      return this.mapTuple(source as TupleValue, (element) =>
        this.resolveValue(element)
      );
    } else {
      return this.resolveVariable(source.asString());
    }
  }

  /**
   * Apply a function to a tuple values recursively
   *
   * @param tuple - Tuple to map
   * @param mapFn - Map function
   *
   * @returns       Mapped tuple
   */
  private mapTuple(tuple: TupleValue, mapFn: (value: Value) => Result): Result {
    const values: Value[] = [];
    for (const value of tuple.values) {
      let result: Result;
      switch (value.type) {
        case ValueType.TUPLE:
          result = this.mapTuple(value as TupleValue, mapFn);
          break;
        default:
          result = mapFn(value);
      }
      if (result.code != ResultCode.OK) return result;
      values.push(result.value);
    }
    return OK(new TupleValue(values));
  }

  private resolveVariable(varname: string): Result {
    const value = this.variableResolver.resolve(varname);
    if (!value) return ERROR(`cannot resolve variable ${varname}`);
    return OK(value);
  }
  private resolveCommand(cmdname: Value) {
    return this.commandResolver.resolve(cmdname);
  }
  private resolveSelector(rules: Value[]) {
    return this.selectorResolver.resolve(rules);
  }
}
