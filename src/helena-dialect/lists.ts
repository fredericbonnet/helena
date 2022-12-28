/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Compiler, Executor } from "../core/compiler";
import { ERROR, OK, Result, ResultCode, YIELD } from "../core/results";
import {
  IntegerValue,
  ListValue,
  NIL,
  ScriptValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Scope } from "./core";
import { NamespaceValueCommand } from "./namespaces";

class ListCommand implements Command {
  scope: Scope;
  namespace: NamespaceValueCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    this.namespace = new NamespaceValueCommand(this.scope);
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.namespace.value);
    if (args.length == 2) return valueToList(args[1]);
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

const listLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("list value length");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(new IntegerValue(values.length));
  },
};
const listAtCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR("list value at index ?default?");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return ListValue.at(values, args[2], args[3]);
  },
};
const listRangeCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR("list value range first ?last?");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    const firstResult = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const first = Math.max(0, firstResult.data);
    if (args.length == 3) {
      if (first >= values.length) return OK(new ListValue([]));
      return OK(new ListValue(values.slice(first)));
    } else {
      const lastResult = IntegerValue.toInteger(args[3]);
      if (lastResult.code != ResultCode.OK) return lastResult;
      const last = lastResult.data;
      if (first >= values.length || last < first || last < 0)
        return OK(new ListValue([]));
      return OK(new ListValue(values.slice(first, last + 1)));
    }
  },
};
const listAppendCmd: Command = {
  execute(args) {
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values2 = [...values];
    for (let i = 2; i < args.length; i++) {
      const { data: values, ...result } = valueToArray(args[i]);
      if (result.code != ResultCode.OK) return result;
      values2.push(...values);
    }
    return OK(new ListValue(values2));
  },
};
const listRemoveCmd: Command = {
  execute(args) {
    if (args.length != 4 && args.length != 5)
      return ARITY_ERROR("list value remove first last");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    const firstResult = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const first = Math.max(0, firstResult.data);
    const lastResult = IntegerValue.toInteger(args[3]);
    if (lastResult.code != ResultCode.OK) return lastResult;
    const last = lastResult.data;
    const head = values.slice(0, first);
    const tail = values.slice(Math.max(first, last + 1));
    return OK(new ListValue([...head, ...tail]));
  },
};
const listInsertCmd: Command = {
  execute(args) {
    if (args.length != 4) return ARITY_ERROR("list value insert index new");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    const indexResult = IntegerValue.toInteger(args[2]);
    if (indexResult.code != ResultCode.OK) return indexResult;
    const index = Math.max(0, indexResult.data);
    const { data: insert, ...result2 } = valueToArray(args[3]);
    if (result2.code != ResultCode.OK) return result2;
    const head = values.slice(0, index);
    const tail = values.slice(index);
    return OK(new ListValue([...head, ...insert, ...tail]));
  },
};
const listReplaceCmd: Command = {
  execute(args) {
    if (args.length != 5)
      return ARITY_ERROR("list value replace first last new");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    const firstResult = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const first = Math.max(0, firstResult.data);
    const lastResult = IntegerValue.toInteger(args[3]);
    if (lastResult.code != ResultCode.OK) return lastResult;
    const last = lastResult.data;
    const head = values.slice(0, first);
    const tail = values.slice(Math.max(first, last + 1));
    const { data: insert, ...result2 } = valueToArray(args[4]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(new ListValue([...head, ...insert, ...tail]));
  },
};

export function valueToList(value: Value): Result {
  if (value.type == ValueType.SCRIPT) {
    const { data, ...result } = valueToArray(value);
    if (result.code != ResultCode.OK) return result;
    return OK(new ListValue(data));
  }
  return ListValue.fromValue(value);
}

export function valueToArray(value: Value): Result<Value[]> {
  if (value.type == ValueType.SCRIPT) {
    const program = new Compiler().compileSentences(
      (value as ScriptValue).script.sentences
    );
    const listExecutor = new Executor(
      { resolve: () => null },
      { resolve: () => null },
      { resolve: () => null }
    );
    const result = listExecutor.execute(program);
    if (result.code != ResultCode.OK) return ERROR("invalid list");
    return OK(NIL, (result.value as TupleValue).values);
  }
  return ListValue.toValues(value);
}

export function registerListCommands(scope: Scope) {
  const command = new ListCommand(scope);
  scope.registerCommand("list", command);
  command.scope.registerCommand("length", listLengthCmd);
  command.scope.registerCommand("at", listAtCmd);
  command.scope.registerCommand("range", listRangeCmd);
  command.scope.registerCommand("append", listAppendCmd);
  command.scope.registerCommand("remove", listRemoveCmd);
  command.scope.registerCommand("insert", listInsertCmd);
  command.scope.registerCommand("replace", listReplaceCmd);
}
