/* eslint-disable jsdoc/require-jsdoc */ // TODO

import { Command } from "../core/command";
import { Result, OK, ERROR, YIELD, ResultCode } from "../core/results";
import {
  Value,
  TupleValue,
  MapValue,
  ValueType,
  NIL,
  StringValue,
  IntegerValue,
  TRUE,
  FALSE,
  ListValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, DeferredValue } from "./core";
import { valueToArray } from "./lists";
import { NamespaceValueCommand } from "./namespaces";

class DictCommand implements Command {
  scope: Scope;
  namespace: NamespaceValueCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    this.namespace = new NamespaceValueCommand(this.scope);
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.namespace.value);
    if (args.length == 2) return valueToMapValue(args[1]);
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

const dictSizeCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value size");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(new IntegerValue(map.size));
  },
};
const dictHasCmd: Command = {
  execute(args) {
    if (args.length != 3) return ARITY_ERROR("dict value has key");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const { data: key, ...result2 } = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(map.has(key) ? TRUE : FALSE);
  },
};
const dictGetCmd: Command = {
  execute(args) {
    if (args.length != 3) return ARITY_ERROR("dict value get key");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const { data: key, ...result2 } = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    if (!map.has(key)) return ERROR("unknown key");
    return OK(map.get(key));
  },
};
const dictAddCmd: Command = {
  execute(args) {
    if (args.length != 4) return ARITY_ERROR("dict value add key value");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const { data: key, ...result2 } = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    const clone = new Map(map);
    return OK(new MapValue(clone.set(key, args[3])));
  },
};
const dictRemoveCmd: Command = {
  execute(args) {
    if (args.length == 2) return valueToMapValue(args[1]);
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const clone = new Map(map);
    for (let i = 2; i < args.length; i++) {
      const { data: key, ...result2 } = StringValue.toString(args[i]);
      if (result2.code != ResultCode.OK) return result2;
      clone.delete(key);
    }
    return OK(new MapValue(clone));
  },
};
const dictMergeCmd: Command = {
  execute(args) {
    if (args.length == 2) return valueToMapValue(args[1]);
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const clone = new Map(map);
    for (let i = 2; i < args.length; i++) {
      const { data: map2, ...result2 } = valueToMap(args[i]);
      if (result2.code != ResultCode.OK) return result2;
      map2.forEach((value, key) => {
        clone.set(key, value);
      });
    }
    return OK(new MapValue(clone));
  },
};
const dictKeysCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value keys");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const key of map.keys()) {
      values.push(new StringValue(key));
    }
    return OK(new ListValue(values));
  },
};
const dictValuesCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value values");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const value of map.values()) {
      values.push(value);
    }
    return OK(new ListValue(values));
  },
};
const dictEntriesCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value entries");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const [key, value] of map.entries()) {
      values.push(new TupleValue([new StringValue(key), value]));
    }
    return OK(new ListValue(values));
  },
};

function valueToMapValue(value: Value): Result {
  switch (value.type) {
    case ValueType.MAP:
      return OK(value);
    case ValueType.SCRIPT:
    case ValueType.LIST:
    case ValueType.TUPLE: {
      const { data, ...result } = valueToMap(value);
      if (result.code != ResultCode.OK) return result;
      return OK(new MapValue(data));
    }
    default:
      return ERROR("invalid map");
  }
}
function valueToMap(value: Value): Result<Map<string, Value>> {
  if (value.type == ValueType.MAP) {
    return OK(NIL, (value as MapValue).map);
  }
  const { data: values, ...result } = valueToArray(value);
  if (result.code != ResultCode.OK) return result;
  if (values.length % 2 != 0) return ERROR("invalid key-value list");
  const map = new Map();
  for (let i = 0; i < values.length; i += 2) {
    const { data: key, ...result } = StringValue.toString(values[i]);
    if (result.code != ResultCode.OK) return result;
    const value = values[i + 1];
    map.set(key, value);
  }
  return OK(NIL, map);
}

export function registerDictCommands(scope: Scope) {
  const command = new DictCommand(scope);
  scope.registerCommand("dict", command);
  command.scope.registerCommand("size", dictSizeCmd);
  command.scope.registerCommand("has", dictHasCmd);
  command.scope.registerCommand("get", dictGetCmd);
  command.scope.registerCommand("add", dictAddCmd);
  command.scope.registerCommand("remove", dictRemoveCmd);
  command.scope.registerCommand("merge", dictMergeCmd);
  command.scope.registerCommand("keys", dictKeysCmd);
  command.scope.registerCommand("values", dictValuesCmd);
  command.scope.registerCommand("entries", dictEntriesCmd);
}
