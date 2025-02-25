/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/commands";
import {
  defaultDisplayFunction,
  DisplayFunction,
  displayList,
} from "../core/display";
import { Result, OK, ERROR, ResultCode } from "../core/results";
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
  StringValue,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, destructureValue, Scope } from "./core";
import { EnsembleCommand } from "./ensembles";
import { valueToArray } from "./lists";

class DictCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = scope.newChildScope();
    const [, argspec] = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope): Result {
    if (args.length == 2) return valueToDictionaryValue(args[1]);
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const DICT_SIZE_SIGNATURE = "dict value size";
const dictSizeCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(DICT_SIZE_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT(map.size));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(DICT_SIZE_SIGNATURE);
    return OK(STR(DICT_SIZE_SIGNATURE));
  },
};

const DICT_HAS_SIGNATURE = "dict value has key";
const dictHasCmd: Command = {
  execute(args) {
    if (args.length != 3) return ARITY_ERROR(DICT_HAS_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [result2, key] = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return ERROR("invalid key");
    return OK(BOOL(map.has(key)));
  },
  help(args) {
    if (args.length > 3) return ARITY_ERROR(DICT_HAS_SIGNATURE);
    return OK(STR(DICT_HAS_SIGNATURE));
  },
};

const DICT_GET_SIGNATURE = "dict value get key ?default?";
const dictGetCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR(DICT_GET_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    switch (args[2].type) {
      case ValueType.TUPLE: {
        if (args.length == 4)
          return ERROR("cannot use default with key tuples");
        const keys = (args[2] as TupleValue).values;
        const values = [];
        for (const k of keys) {
          const [result, key] = StringValue.toString(k);
          if (result.code != ResultCode.OK) return ERROR("invalid key");
          if (!map.has(key)) return ERROR(`unknown key "${key}"`);
          values.push(map.get(key));
        }
        return OK(TUPLE(values));
      }
      default: {
        const [result, key] = StringValue.toString(args[2]);
        if (result.code != ResultCode.OK) return ERROR("invalid key");
        if (!map.has(key))
          return args.length == 4 ? OK(args[3]) : ERROR(`unknown key "${key}"`);
        return OK(map.get(key));
      }
    }
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(DICT_GET_SIGNATURE);
    return OK(STR(DICT_GET_SIGNATURE));
  },
};

const DICT_ADD_SIGNATURE = "dict value add key value";
const dictAddCmd: Command = {
  execute(args) {
    if (args.length != 4) return ARITY_ERROR(DICT_ADD_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [result2, key] = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return ERROR("invalid key");
    const clone = new Map(map);
    return OK(DICT(clone.set(key, args[3])));
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(DICT_ADD_SIGNATURE);
    return OK(STR(DICT_ADD_SIGNATURE));
  },
};

const DICT_REMOVE_SIGNATURE = "dict value remove ?key ...?";
const dictRemoveCmd: Command = {
  execute(args) {
    if (args.length == 2) return valueToDictionaryValue(args[1]);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const clone = new Map(map);
    for (let i = 2; i < args.length; i++) {
      const [result2, key] = StringValue.toString(args[i]);
      if (result2.code != ResultCode.OK) return ERROR("invalid key");
      clone.delete(key);
    }
    return OK(DICT(clone));
  },
  help() {
    return OK(STR(DICT_REMOVE_SIGNATURE));
  },
};

const DICT_MERGE_SIGNATURE = "dict value merge ?dict ...?";
const dictMergeCmd: Command = {
  execute(args) {
    if (args.length == 2) return valueToDictionaryValue(args[1]);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const clone = new Map(map);
    for (let i = 2; i < args.length; i++) {
      const [result2, map2] = valueToMap(args[i]);
      if (result2.code != ResultCode.OK) return result2;
      map2.forEach((value, key) => {
        clone.set(key, value);
      });
    }
    return OK(DICT(clone));
  },
  help() {
    return OK(STR(DICT_MERGE_SIGNATURE));
  },
};

const DICT_KEYS_SIGNATURE = "dict value keys";
const dictKeysCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(DICT_KEYS_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const key of map.keys()) {
      values.push(STR(key));
    }
    return OK(LIST(values));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(DICT_KEYS_SIGNATURE);
    return OK(STR(DICT_KEYS_SIGNATURE));
  },
};

const DICT_VALUES_SIGNATURE = "dict value values";
const dictValuesCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(DICT_VALUES_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const value of map.values()) {
      values.push(value);
    }
    return OK(LIST(values));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(DICT_VALUES_SIGNATURE);
    return OK(STR(DICT_VALUES_SIGNATURE));
  },
};

const DICT_ENTRIES_SIGNATURE = "dict value entries";
const dictEntriesCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(DICT_ENTRIES_SIGNATURE);
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    const values = [];
    for (const [key, value] of map.entries()) {
      values.push(TUPLE([STR(key), value]));
    }
    return OK(LIST(values));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(DICT_ENTRIES_SIGNATURE);
    return OK(STR(DICT_ENTRIES_SIGNATURE));
  },
};

const DICT_FOREACH_SIGNATURE = "dict value foreach ?index? entry body";
const dictForeachCmd: Command = {
  execute(args, scope: Scope) {
    let index: string;
    let varname, body: Value;
    switch (args.length) {
      case 4:
        varname = args[2];
        body = args[3];
        break;
      case 5: {
        const [result, name] = StringValue.toString(args[2]);
        if (result.code != ResultCode.OK) return ERROR("invalid index name");
        index = name;
        varname = args[3];
        body = args[4];
        break;
      }
      default:
        return ARITY_ERROR(DICT_FOREACH_SIGNATURE);
    }
    const [result, map] = valueToMap(args[1]);
    if (result.code != ResultCode.OK) return result;
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");
    const program = scope.compileScriptValue(body as ScriptValue);
    const subscope = scope.newLocalScope();
    const it = map.entries();
    let i = 0;
    let lastResult = OK(NIL);
    const next = () => {
      const { value: entry, done } = it.next();
      if (done) return lastResult;
      if (index) {
        subscope.setNamedLocal(index, INT(i++));
      }
      const [key, value] = entry;
      const result = destructureValue(
        subscope.destructureLocal.bind(subscope),
        varname,
        TUPLE([STR(key), value])
      );
      if (result.code != ResultCode.OK) return result;
      return ContinuationValue.create(subscope, program, (result) => {
        switch (result.code) {
          case ResultCode.BREAK:
            return lastResult;
          case ResultCode.CONTINUE:
            break;
          case ResultCode.OK:
            lastResult = result;
            break;
          default:
            return result;
        }
        return next();
      });
    };
    return next();
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(DICT_FOREACH_SIGNATURE);
    return OK(STR(DICT_FOREACH_SIGNATURE));
  },
};

function valueToDictionaryValue(value: Value): Result {
  switch (value.type) {
    case ValueType.DICTIONARY:
      return OK(value);
    case ValueType.SCRIPT:
    case ValueType.LIST:
    case ValueType.TUPLE: {
      const [result, map] = valueToMap(value);
      if (result.code != ResultCode.OK) return result;
      return OK(DICT(map));
    }
    default:
      return ERROR("invalid dictionary");
  }
}
function valueToMap(value: Value): [Result, Map<string, Value>?] {
  if (value.type == ValueType.DICTIONARY) {
    return [OK(NIL), (value as DictionaryValue).map];
  }
  const [result, values] = valueToArray(value);
  if (result.code != ResultCode.OK) return [result];
  if (values.length % 2 != 0) return [ERROR("invalid key-value list")];
  const map = new Map();
  for (let i = 0; i < values.length; i += 2) {
    const [result, key] = StringValue.toString(values[i]);
    if (result.code != ResultCode.OK) return [ERROR("invalid key")];
    const value = values[i + 1];
    map.set(key, value);
  }
  return [OK(NIL), map];
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
