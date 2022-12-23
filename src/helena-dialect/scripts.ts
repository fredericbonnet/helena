/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Parser } from "../core/parser";
import { Result, OK, ERROR, YIELD, ResultCode } from "../core/results";
import { Script, Sentence } from "../core/syntax";
import { Tokenizer } from "../core/tokenizer";
import {
  Value,
  TupleValue,
  ValueType,
  ScriptValue,
  StringValue,
  IntegerValue,
  ListValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, DeferredValue } from "./core";
import { NamespaceValueCommand } from "./namespaces";

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
  namespace: NamespaceValueCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    this.namespace = new NamespaceValueCommand(this.scope);
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.namespace.value);
    if (args.length == 2) return valueToScript(args[1]);
    const [, value, subcommand, ...rest] = args;
    if (!this.scope.hasLocalCommand(subcommand.asString()))
      return ERROR(`invalid subcommand name "${subcommand.asString()}"`);
    return YIELD(
      new DeferredValue(
        new TupleValue([subcommand, value, ...rest]),
        this.scope
      )
    );
  }
}

const scriptLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("script value length");
    const result = valueToScript(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(
      new IntegerValue((result.value as ScriptValue).script.sentences.length)
    );
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
    return OK(new ListValue(sentences));
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
  scope.registerCommand("parse", parseCmd);
  const command = new ScriptCommand(scope);
  scope.registerCommand("script", command);
  command.scope.registerCommand("length", scriptLengthCmd);
  command.scope.registerCommand("append", scriptAppendCmd);
  command.scope.registerCommand("split", scriptSplitCmd);
}
