/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result } from "../core/results";
import {
  BooleanValue,
  IntegerValue,
  ListValue,
  MapValue,
  NIL,
  NumberValue,
  StringValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";

export const consoleCmd: Command = {
  execute: function (args: Value[]): Result {
    if (args.length < 2) {
      return ERROR('wrong # args: should be "console method ?arg ...?"');
    }
    const method = args[1].asString?.();
    if (method == null) return ERROR("invalid method name");
    switch (method) {
      case "assert": {
        const { data } = BooleanValue.toBoolean(args[2]);
        console.assert(data, ...args.slice(3).map((v) => v.asString?.()));
        return OK(NIL);
      }
      case "clear":
        console.clear();
        return OK(NIL);

      case "count":
      case "countReset":
        console[method](args[2]?.asString?.());
        return OK(NIL);

      case "debug":
      case "error":
      case "info":
      case "log":
      case "trace":
      case "warn":
        console[method](...args.slice(2).map(toLog));
        return OK(NIL);

      case "dir":
      case "dirxml":
        console[method](args[2]);
        return OK(NIL);

      case "group":
      case "groupCollapsed":
        console[method](args[2]?.asString?.());
        return OK(NIL);
      case "groupEnd":
        console.groupEnd();
        return OK(NIL);

      case "table":
        console.table(toLog(args[2]));
        return OK(NIL);

      case "time":
      case "timeEnd":
      case "timeLog":
        console[method](args[2]?.asString?.());
        return OK(NIL);

      default:
        return ERROR(`unknown method "${method}"`);
    }
  },
};

function toLog(value: Value) {
  switch (value?.type) {
    case ValueType.NIL:
      return null;
    case ValueType.BOOLEAN:
      return (value as BooleanValue).value;
    case ValueType.INTEGER:
      return (value as IntegerValue).value;
    case ValueType.NUMBER:
      return (value as NumberValue).value;
    case ValueType.STRING:
      return (value as StringValue).value;
    case ValueType.LIST:
      return (value as ListValue).values.map(toLog);
    case ValueType.MAP:
      return new Map(
        [...(value as MapValue).map.entries()].map(([key, value]) => [
          key,
          toLog(value),
        ])
      );
    case ValueType.TUPLE:
      return (value as TupleValue).values.map(toLog);
    default:
      return value;
  }
}
