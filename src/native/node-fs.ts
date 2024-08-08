/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "node:fs";
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  IntegerValue,
  DictionaryValue,
  NIL,
  STR,
  Value,
  ValueType,
  StringValue,
} from "../core/values";

const asString = (value) => StringValue.toString(value)[1];

export type CallbackContext = {
  callback: (args: Value[], context?: unknown) => void;
  context?: unknown;
};

export const fsCmd: Command = {
  execute: (args: Value[], context?: CallbackContext): Result => {
    if (args.length < 2)
      return ERROR('wrong # args: should be "node:fs method ?arg ...?"');
    const method = asString(args[1]);
    if (method == null) return ERROR("invalid method value");
    switch (method) {
      case "readFile": {
        if (args.length != 4 && args.length != 5)
          return ERROR(
            'wrong # args: should be "node:fs readFile path ?options? callback"'
          );
        const path = asString(args[2]);
        if (path == null) return ERROR("invalid path value");
        if (args.length == 5 && args[3].type != ValueType.DICTIONARY)
          return ERROR("options must be a map");
        const options =
          args.length == 5 ? toOptions(args[3] as DictionaryValue) : {};
        try {
          fs.readFile(path, options, (err, data) => {
            context.callback(
              [
                args[args.length - 1],
                err ? STR(err.message) : NIL,
                data ? STR(data) : NIL,
              ],
              context.context
            );
          });
          return OK(NIL);
        } catch (e) {
          return ERROR(e.message);
        }
      }
      case "readFileSync": {
        if (args.length != 3 && args.length != 4)
          return ERROR(
            'wrong # args: should be "node:fs readFileSync path ?options?"'
          );
        const path = asString(args[2]);
        if (path == null) return ERROR("invalid path value");
        if (args.length == 4 && args[3].type != ValueType.DICTIONARY)
          return ERROR("options must be a map");
        const options =
          args.length == 4 ? toOptions(args[3] as DictionaryValue) : {};
        try {
          const data = fs.readFileSync(path, options);
          return OK(STR(data));
        } catch (e) {
          return ERROR(e.message);
        }
      }
      case "writeFile": {
        if (args.length != 5 && args.length != 6)
          return ERROR(
            'wrong # args: should be "node:fs writeFile file data ?options? callback"'
          );
        const file = asString(args[2]);
        if (file == null) return ERROR("invalid path value");
        const data = asString(args[3]);
        if (data == null) return ERROR("invalid data value");
        if (args.length == 6 && args[4].type != ValueType.DICTIONARY)
          return ERROR("options must be a map");
        const options =
          args.length == 6 ? toOptions(args[4] as DictionaryValue) : {};
        try {
          fs.writeFile(file, data, options, (err) => {
            context.callback(
              [args[args.length - 1], err ? STR(err.message) : NIL],
              context.context
            );
          });
          return OK(NIL);
        } catch (e) {
          return ERROR(e.message);
        }
      }
      case "writeFileSync": {
        if (args.length != 4 && args.length != 5)
          return ERROR(
            'wrong # args: should be "node:fs writeFileSync file data ?options?"'
          );
        const file = asString(args[2]);
        if (file == null) return ERROR("invalid path value");
        const data = asString(args[3]);
        if (data == null) return ERROR("invalid data value");
        if (args.length == 5 && args[4].type != ValueType.DICTIONARY)
          return ERROR("options must be a map");
        const options =
          args.length == 5 ? toOptions(args[4] as DictionaryValue) : {};
        try {
          fs.writeFileSync(file, data, options);
          return OK(NIL);
        } catch (e) {
          return ERROR(e.message);
        }
      }
      default:
        return ERROR(`unknown method "${method}"`);
    }
  },
};

const optionConverters = {
  encoding: toString,
  mode: toNumber,
  flag: toString,
};
function toOptions({ map }: DictionaryValue) {
  const options = {};
  map.forEach((value, key) => {
    if (optionConverters[key]) options[key] = optionConverters[key](value);
  });
  return options;
}
function toString(value: Value): string {
  return asString(value) ?? undefined;
}
function toNumber(value: Value): number {
  if (!value) return undefined;
  const [result, n] = IntegerValue.toInteger(value);
  return result.code == ResultCode.OK ? n : undefined;
}
