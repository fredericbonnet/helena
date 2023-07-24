/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import {
  defaultDisplayFunction,
  DisplayFunction,
  displayList,
} from "../core/display";
import { Result, OK, ERROR, ResultCode, YIELD } from "../core/results";
import {
  Value,
  TupleValue,
  DictionaryValue,
  ValueType,
  NIL,
  ScriptValue,
  INT,
  LIST,
  DICT,
  STR,
  TUPLE,
  BOOL,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { destructureValue, Process, Scope } from "./core";
import { EnsembleMetacommand } from "./ensembles";
import { valueToArray } from "./lists";

class DictCommand implements Command {
  scope: Scope;
  ensemble: EnsembleMetacommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleMetacommand(this.scope, argspec);
  }
  execute(args: Value[], scope): Result {
    if (args.length == 1) return OK(this.ensemble);
    if (args.length == 2) return valueToDictionaryValue(args[1]);
    return this.ensemble.ensemble.execute(args, scope);
  }
  help(args) {
    // TODO handle args to ensemble subcommands
    return OK(STR("dict ?value? ?subcommand? ?arg ...?"));
  }
}

const dictSizeCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value size");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT(map.size));
  },
};
const dictHasCmd: Command = {
  execute(args) {
    if (args.length != 3) return ARITY_ERROR("dict value has key");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const key = args[2].asString?.();
    if (key == null) return ERROR("invalid key");
    return OK(BOOL(map.has(key)));
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
          const key = k.asString?.();
          if (key == null) return ERROR("invalid key");
          if (!map.has(key)) return ERROR(`unknown key "${key}"`);
          values.push(map.get(key));
        }
        return OK(TUPLE(values));
      }
      default: {
        const key = args[2].asString?.();
        if (key == null) return ERROR("invalid key");
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
    const key = args[2].asString?.();
    if (key == null) return ERROR("invalid key");
    const clone = new Map(map);
    return OK(DICT(clone.set(key, args[3])));
  },
};
const dictRemoveCmd: Command = {
  execute(args) {
    if (args.length == 2) return valueToDictionaryValue(args[1]);
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const clone = new Map(map);
    for (let i = 2; i < args.length; i++) {
      const key = args[i].asString?.();
      if (key == null) return ERROR("invalid key");
      clone.delete(key);
    }
    return OK(DICT(clone));
  },
};
const dictMergeCmd: Command = {
  execute(args) {
    if (args.length == 2) return valueToDictionaryValue(args[1]);
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
    return OK(DICT(clone));
  },
};
const dictKeysCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value keys");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const key of map.keys()) {
      values.push(STR(key));
    }
    return OK(LIST(values));
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
    return OK(LIST(values));
  },
};
const dictEntriesCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("dict value entries");
    const { data: map, ...result } = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const [key, value] of map.entries()) {
      values.push(TUPLE([STR(key), value]));
    }
    return OK(LIST(values));
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
    const subscope = new Scope(scope, true);
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
          const setLocal = (name, value) => {
            state.scope.setLocal(name.asString(), value);
            return OK(value);
          };
          destructureValue(setLocal, state.varname, TUPLE([STR(key), value]));
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

function valueToDictionaryValue(value: Value): Result {
  switch (value.type) {
    case ValueType.DICTIONARY:
      return OK(value);
    case ValueType.SCRIPT:
    case ValueType.LIST:
    case ValueType.TUPLE: {
      const { data, ...result } = valueToMap(value);
      if (result.code != ResultCode.OK) return result;
      return OK(DICT(data));
    }
    default:
      return ERROR("invalid dictionary");
  }
}
function valueToMap(value: Value): Result<Map<string, Value>> {
  if (value.type == ValueType.DICTIONARY) {
    return OK(NIL, (value as DictionaryValue).map);
  }
  const { data: values, ...result } = valueToArray(value);
  if (result.code != ResultCode.OK) return result;
  if (values.length % 2 != 0) return ERROR("invalid key-value list");
  const map = new Map();
  for (let i = 0; i < values.length; i += 2) {
    const key = values[i].asString?.();
    if (key == null) return ERROR("invalid key");
    const value = values[i + 1];
    map.set(key, value);
  }
  return OK(NIL, map);
}

export function displayDictionaryValue(
  dictionary: DictionaryValue,
  fn: DisplayFunction = defaultDisplayFunction
) {
  const values = [];
  for (const [key, value] of dictionary.map.entries()) {
    values.push(STR(key), value);
  }
  return `[dict (${displayList(values, fn)})]`;
}

export function registerDictCommands(scope: Scope) {
  const command = new DictCommand(scope);
  scope.registerNamedCommand("dict", command);
  command.scope.registerNamedCommand("size", dictSizeCmd);
  command.scope.registerNamedCommand("has", dictHasCmd);
  command.scope.registerNamedCommand("get", dictGetCmd);
  command.scope.registerNamedCommand("add", dictAddCmd);
  command.scope.registerNamedCommand("remove", dictRemoveCmd);
  command.scope.registerNamedCommand("merge", dictMergeCmd);
  command.scope.registerNamedCommand("keys", dictKeysCmd);
  command.scope.registerNamedCommand("values", dictValuesCmd);
  command.scope.registerNamedCommand("entries", dictEntriesCmd);
  command.scope.registerNamedCommand("foreach", dictForeachCmd);
}
