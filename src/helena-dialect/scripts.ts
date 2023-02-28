/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Parser } from "../core/parser";
import { Result, OK, ERROR, ResultCode } from "../core/results";
import { Script, Sentence } from "../core/syntax";
import { Tokenizer } from "../core/tokenizer";
import {
  Value,
  TupleValue,
  ValueType,
  ScriptValue,
  StringValue,
  INT,
  LIST,
  STR,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { EnsembleValue } from "./ensembles";

const parseCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("parse source");
    const { data: source, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const tokenizer = new Tokenizer();
    const parser = new Parser();
    const { success, script, message } = parser.parse(
      tokenizer.tokenize(source)
    );
    if (!success) return ERROR(message);
    return OK(new ScriptValue(script, source));
  },
};

class ScriptCommand implements Command {
  scope: Scope;
  ensemble: EnsembleValue;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleValue(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.ensemble);
    if (args.length == 2) return valueToScript(args[1]);
    return this.ensemble.ensemble.execute(args, scope);
  }
}

const scriptLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("script value length");
    const result = valueToScript(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT((result.value as ScriptValue).script.sentences.length));
  },
};
const scriptAppendCmd: Command = {
  execute(args) {
    const result = valueToScript(args[1]);
    if (result.code != ResultCode.OK) return result;
    if (args.length == 2) return result;
    const script = new Script();
    script.sentences.push(...(result.value as ScriptValue).script.sentences);
    for (let i = 2; i < args.length; i++) {
      const result2 = valueToScript(args[i]);
      if (result2.code != ResultCode.OK) return result2;
      script.sentences.push(...(result2.value as ScriptValue).script.sentences);
    }
    return OK(new ScriptValue(script, undefined));
  },
};
const scriptSplitCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("script value split");
    const result = valueToScript(args[1]);
    if (result.code != ResultCode.OK) return result;
    const sentences = [];
    for (const sentence of (result.value as ScriptValue).script.sentences) {
      const script = new Script();
      script.sentences.push(sentence);
      sentences.push(new ScriptValue(script, undefined));
    }
    return OK(LIST(sentences));
  },
};

function valueToScript(value: Value): Result {
  switch (value.type) {
    case ValueType.SCRIPT:
      return OK(value);
    case ValueType.TUPLE:
      return OK(tupleToScript(value as TupleValue));
    default:
      return ERROR("value must be a script or tuple");
  }
}

function tupleToScript(tuple: TupleValue) {
  const script = new Script();
  if (tuple.values.length != 0) {
    const sentence = new Sentence();
    sentence.words.push(...tuple.values);
    script.sentences.push(sentence);
  }
  return new ScriptValue(script, undefined);
}

export function registerScriptCommands(scope: Scope) {
  scope.registerNamedCommand("parse", parseCmd);
  const command = new ScriptCommand(scope);
  scope.registerNamedCommand("script", command);
  command.scope.registerNamedCommand("length", scriptLengthCmd);
  command.scope.registerNamedCommand("append", scriptAppendCmd);
  command.scope.registerNamedCommand("split", scriptSplitCmd);
}
