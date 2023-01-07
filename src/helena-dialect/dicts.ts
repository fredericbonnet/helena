/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import { Result, OK, ERROR, ResultCode, YIELD } from "../core/results";
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
  ScriptValue,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Process, Scope, ScopeContext } from "./core";
import { EnsembleValueCommand } from "./ensembles";
import { valueToArray } from "./lists";

class DictCommand implements Command {
  scope: Scope;
  ensemble: EnsembleValueCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(
      new ListValue([new StringValue("value")])
    );
    this.ensemble = new EnsembleValueCommand(this.scope, argspec);
  }
  execute(args: Value[], scope): Result {
    if (args.length == 1) return OK(this.ensemble.value);
    if (args.length == 2) return valueToMapValue(args[1]);
    return this.ensemble.value.ensemble.execute(args, scope);
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
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR("dict value get key ?default?");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    switch (args[2].type) {
      case ValueType.TUPLE: {
        if (args.length == 4)
          return ERROR("cannot use default with key tuples");
        const keys = (args[2] as TupleValue).values;
        const values = [];
        for (const k of keys) {
          const { data: key, ...result2 } = StringValue.toString(k);
          if (result2.code != ResultCode.OK) return result2;
          if (!map.has(key)) return ERROR(`unknown key "${key}"`);
          values.push(map.get(key));
        }
        return OK(new TupleValue(values));
      }
      default: {
        const { data: key, ...result2 } = StringValue.toString(args[2]);
        if (result2.code != ResultCode.OK) return result2;
        if (!map.has(key))
          return args.length == 4 ? OK(args[3]) : ERROR(`unknown key "${key}"`);
        return OK(map.get(key));
      }
    }
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
type DictForeachState = {
  varname: Value;
  it: IterableIterator<[string, Value]>;
  step: "beforeBody" | "inBody";
  program: Program;
  scope: Scope;
  process?: Process;
  lastResult: Result;
};
class DictForeachCommand implements Command {
  execute(args, scope: Scope) {
    if (args.length != 4) return ARITY_ERROR("dict value foreach entry body");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const varname = args[2];
    const body = args[3];
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
    const program = scope.compile((body as ScriptValue).script);
    const locals: Map<string, Value> = new Map();
    const subscope = new Scope(scope, new ScopeContext(scope.context, locals));
    return this.run({
      varname,
      it: map.entries(),
      step: "beforeBody",
      program,
      scope: subscope,
      lastResult: OK(NIL),
    });
  }
  resume(result: Result): Result {
    const state = result.data as DictForeachState;
    state.process.yieldBack(result.value);
    return this.run(state);
  }
  private run(state: DictForeachState) {
    for (;;) {
      switch (state.step) {
        case "beforeBody": {
          const { value: entry, done } = state.it.next();
          if (done) return state.lastResult;
          const [key, value] = entry;
          switch (state.varname.type) {
            case ValueType.TUPLE: {
              const tuple = state.varname as TupleValue;
              if (tuple.values.length >= 1)
                state.scope.context.locals.set(
                  tuple.values[0].asString(),
                  new StringValue(key)
                );
              if (tuple.values.length >= 2)
                state.scope.context.locals.set(
                  tuple.values[1].asString(),
                  value
                );
              break;
            }
            default:
              state.scope.context.locals.set(
                state.varname.asString(),
                new TupleValue([new StringValue(key), value])
              );
          }
          state.process = state.scope.prepareProcess(state.program);
          state.step = "inBody";
          break;
        }
        case "inBody": {
          const result = state.process.run();
          if (result.code == ResultCode.YIELD)
            return YIELD(result.value, state);
          state.step = "beforeBody";
          if (result.code == ResultCode.BREAK) return state.lastResult;
          if (result.code == ResultCode.CONTINUE) continue;
          if (result.code != ResultCode.OK) return result;
          state.lastResult = result;
          break;
        }
      }
    }
  }
}
const dictForeachCmd = new DictForeachCommand();

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
  command.scope.registerCommand("foreach", dictForeachCmd);
}
