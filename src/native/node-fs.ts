/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as fs from "node:fs";
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  IntegerValue,
  MapValue,
  NIL,
  STR,
  Value,
  ValueType,
} from "../core/values";

export const fsCmd: Command = {
  execute: (args: Value[]): Result => {
    if (args.length < 2)
      return ERROR('wrong # args: should be "node:fs method ?arg ...?"');
    const method = args[1].asString?.();
    if (method == null) return ERROR("invalid method value");
    switch (method) {
      case "readFileSync": {
        if (args.length != 3 && args.length != 4)
          return ERROR(
            'wrong # args: should be "node:fs readFileSync path ?options?"'
          );
        const path = args[2].asString?.();
        if (path == null) return ERROR("invalid path value");
        if (args.length == 4 && args[3].type != ValueType.MAP)
          return ERROR("options must be a map");
        const options = args.length == 4 ? toOptions(args[3] as MapValue) : {};
        try {
          const data = fs.readFileSync(path, options);
          return OK(STR(data));
        } catch (e) {
          return ERROR(e.message);
        }
      }
      case "writeFileSync": {
        if (args.length != 4 && args.length != 5)
          return ERROR(
            'wrong # args: should be "node:fs writeFileSync file data ?options?"'
          );
        const file = args[2].asString?.();
        if (file == null) return ERROR("invalid path value");
        const data = args[3].asString?.();
        if (data == null) return ERROR("invalid data value");
        if (args.length == 5 && args[4].type != ValueType.MAP)
          return ERROR("options must be a map");
        const options = args.length == 5 ? toOptions(args[4] as MapValue) : {};
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
function toOptions({ map }: MapValue) {
  const options = {};
  map.forEach((value, key) => {
    if (optionConverters[key]) options[key] = optionConverters[key](value);
  });
  return options;
}
function toString(value: Value): string {
  return value?.asString?.() ?? undefined;
}
function toNumber(value: Value): number {
  if (!value) return undefined;
  const { data, ...result } = IntegerValue.toInteger(value);
  return result.code == ResultCode.OK ? data : undefined;
}
