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
import { EnsembleCommand } from "./ensembles";

const PARSE_SIGNATURE = "parse source";
const parseCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(PARSE_SIGNATURE);
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
  help(args) {
    if (args.length > 2) return ARITY_ERROR(PARSE_SIGNATURE);
    return OK(STR(PARSE_SIGNATURE));
  },
};

class ScriptCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return valueToScript(args[1]);
    return this.ensemble.execute(args, scope);
  }
  resume(result: Result): Result {
    return this.ensemble.resume(result);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const SCRIPT_LENGTH_SIGNATURE = "script value length";
const scriptLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(SCRIPT_LENGTH_SIGNATURE);
    const result = valueToScript(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT((result.value as ScriptValue).script.sentences.length));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(SCRIPT_LENGTH_SIGNATURE);
    return OK(STR(SCRIPT_LENGTH_SIGNATURE));
  },
};

const SCRIPT_APPEND_SIGNATURE = "script value append ?script ...?";
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
  help() {
    return OK(STR(SCRIPT_APPEND_SIGNATURE));
  },
};

const SCRIPT_SPLIT_SIGNATURE = "script value split";
const scriptSplitCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(SCRIPT_SPLIT_SIGNATURE);
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
  help(args) {
    if (args.length > 2) return ARITY_ERROR(SCRIPT_SPLIT_SIGNATURE);
    return OK(STR(SCRIPT_SPLIT_SIGNATURE));
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
