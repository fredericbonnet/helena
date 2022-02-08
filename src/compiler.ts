import { CommandResolver, VariableResolver } from "./evaluator";
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
  TaggedStringMorpheme,
  TupleMorpheme,
  Word,
} from "./syntax";
import {
  ScriptValue,
  StringValue,
  TupleValue,
  Value,
  ValueType,
} from "./values";

export class Compiler {
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
      result.push(new PushTuple(this.compileSentence(sentence)));
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
    return this.compileMorphemes(word.morphemes);
  }
  compileMorphemes(morphemes: Morpheme[]): Operation[] {
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
          const value = new StringValue(literal.value);
          result.push(new PushLiteral(value));
          if (mode == "substitute") {
            result.push(new ResolveValue());
            mode = "selectable";
          } else {
            mode = "";
          }
          break;
        }

        case MorphemeType.TUPLE: {
          const tuple = morpheme as TupleMorpheme;
          const compiled = this.compile(tuple.subscript);
          result.push(new PushTuple(compiled));
          if (mode == "selectable") {
            result.push(new SelectKeys());
          } else if (mode == "substitute") {
            result.push(new ResolveValue());
            mode = "selectable";
          } else {
            mode = "";
          }
          break;
        }

        case MorphemeType.BLOCK: {
          const block = morpheme as BlockMorpheme;
          if (mode == "substitute") {
            const value = new StringValue(block.value);
            result.push(new PushLiteral(value));
            result.push(new ResolveValue());
            mode = "selectable";
          } else {
            const value = new ScriptValue(block.subscript, block.value);
            result.push(new PushLiteral(value));
            mode = "";
          }
          break;
        }

        case MorphemeType.EXPRESSION: {
          const expression = morpheme as ExpressionMorpheme;
          result.push(...this.compileScript(expression.subscript));
          result.push(new SubstituteResult());
          if (mode == "selectable") {
            result.push(new SelectIndex());
          } else if (mode == "substitute") {
            mode = "selectable";
          } else {
            mode = "";
          }
          break;
        }

        case MorphemeType.STRING: {
          const string = morpheme as StringMorpheme;
          result.push(new PushTuple(this.compileMorphemes(string.morphemes)));
          result.push(new JoinStrings());
          break;
        }

        case MorphemeType.HERE_STRING: {
          const string = morpheme as HereStringMorpheme;
          const value = new StringValue(string.value);
          result.push(new PushLiteral(value));
          break;
        }

        case MorphemeType.TAGGED_STRING: {
          const string = morpheme as TaggedStringMorpheme;
          const value = new StringValue(string.value);
          result.push(new PushLiteral(value));
          break;
        }

        case MorphemeType.LINE_COMMENT:
        case MorphemeType.BLOCK_COMMENT:
          // Ignore
          break;

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
}
export interface Operation {
  execute(context: Context);
}
export class PushLiteral implements Operation {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
  execute(context: Context) {
    context.push(this.value);
  }
}
export class PushTuple implements Operation {
  operations: Operation[];
  constructor(operations: Operation[]) {
    this.operations = operations;
  }
  execute(context: Context) {
    context.openFrame();
    for (let operation of this.operations) {
      operation.execute(context);
    }
    const values = context.closeFrame();
    context.push(new TupleValue(values));
  }
}
export class ResolveValue implements Operation {
  execute(context: Context) {
    const source = context.pop();
    context.push(this.resolveValue(context, source));
  }
  private resolveValue(context: Context, source: Value) {
    if (source.type == ValueType.TUPLE) {
      return this.mapTuple(source as TupleValue, (element) =>
        this.resolveValue(context, element)
      );
    } else {
      return this.resolveVariable(context, source.asString());
    }
  }
  private resolveVariable(context, varname: string): Value {
    let value = context.variableResolver.resolve(varname);
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
export class EvaluateSentence implements Operation {
  execute(context: Context) {
    const args = context.pop() as TupleValue;
    const cmdname = args.values[0].asString();
    const command = context.commandResolver.resolve(cmdname);
    if (!command) throw new Error(`cannot resolve command ${cmdname}`);
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
  variableResolver: VariableResolver;
  commandResolver: CommandResolver;
  frames: Value[][] = [[]];
  result: Value;

  constructor(variableResolver, commandResolver) {
    this.variableResolver = variableResolver;
    this.commandResolver = commandResolver;
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
  execute(operations: Operation[]): Value {
    for (let operation of operations) {
      operation.execute(this);
    }
    this.result = this.pop();
    return this.result;
  }
}
