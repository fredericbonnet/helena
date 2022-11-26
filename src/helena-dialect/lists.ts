/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Compiler, Executor } from "../core/compiler";
import { ERROR, OK, Result, ResultCode } from "../core/results";
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

export const listCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length < 2)
      return ERROR(
        `wrong # args: should be "list value ?subcommand? ?arg ...?"`
      );
    if (args.length == 2) return valueToList(args[1]);
    const result = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = result.data;
    const subcommand = args[2];
    switch (subcommand.asString()) {
      case "length":
        if (args.length != 3) return ARITY_ERROR("list value length");
        return OK(new IntegerValue(values.length));
      case "at":
        if (args.length != 4) return ARITY_ERROR("list value at index");
        return ListValue.at(values, args[3]);
      case "range": {
        if (args.length != 4 && args.length != 5)
          return ARITY_ERROR("list value range first ?last?");
        const firstResult = IntegerValue.toInteger(args[3]);
        if (firstResult.code != ResultCode.OK) return firstResult;
        const first = Math.max(0, firstResult.data);
        if (args.length == 4) {
          if (first >= values.length) return OK(new ListValue([]));
          return OK(new ListValue(values.slice(first)));
        } else {
          const lastResult = IntegerValue.toInteger(args[4]);
          if (lastResult.code != ResultCode.OK) return lastResult;
          const last = lastResult.data;
          if (first >= values.length || last < first || last < 0)
            return OK(new ListValue([]));
          return OK(new ListValue(values.slice(first, last + 1)));
        }
      }
      case "append": {
        const values2 = [...values];
        for (let i = 3; i < args.length; i++) {
          const newResult = valueToArray(args[i]);
          if (newResult.code != ResultCode.OK) return newResult;
          values2.push(...newResult.data);
        }
        return OK(new ListValue(values2));
      }
      case "remove": {
        if (args.length != 5 && args.length != 6)
          return ARITY_ERROR("list value remove first last");
        const firstResult = IntegerValue.toInteger(args[3]);
        if (firstResult.code != ResultCode.OK) return firstResult;
        const first = Math.max(0, firstResult.data);
        const lastResult = IntegerValue.toInteger(args[4]);
        if (lastResult.code != ResultCode.OK) return lastResult;
        const last = lastResult.data;
        const head = values.slice(0, first);
        const tail = values.slice(Math.max(first, last + 1));
        return OK(new ListValue([...head, ...tail]));
      }
      case "insert": {
        if (args.length != 5) return ARITY_ERROR("list value insert index new");
        const indexResult = IntegerValue.toInteger(args[3]);
        if (indexResult.code != ResultCode.OK) return indexResult;
        const index = Math.max(0, indexResult.data);
        const newResult = valueToArray(args[4]);
        if (newResult.code != ResultCode.OK) return newResult;
        const head = values.slice(0, index);
        const tail = values.slice(index);
        return OK(new ListValue([...head, ...newResult.data, ...tail]));
      }
      case "replace": {
        if (args.length != 6)
          return ARITY_ERROR("list value replace first last new");
        const firstResult = IntegerValue.toInteger(args[3]);
        if (firstResult.code != ResultCode.OK) return firstResult;
        const first = Math.max(0, firstResult.data);
        const lastResult = IntegerValue.toInteger(args[4]);
        if (lastResult.code != ResultCode.OK) return lastResult;
        const last = lastResult.data;
        const head = values.slice(0, first);
        const tail = values.slice(Math.max(first, last + 1));
        const newResult = valueToArray(args[5]);
        if (newResult.code != ResultCode.OK) return newResult;
        return OK(new ListValue([...head, ...newResult.data, ...tail]));
      }
      default:
        return ERROR(`invalid subcommand name "${subcommand.asString()}"`);
    }
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
