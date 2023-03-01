/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as child_process from "node:child_process";
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  IntegerValue,
  MapValue,
  STR,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";

export const childProcessCmd: Command = {
  execute: (args: Value[]): Result => {
    if (args.length < 2)
      return ERROR(
        'wrong # args: should be "node:child_process method ?arg ...?"'
      );
    const method = args[1].asString?.();
    if (method == null) return ERROR("invalid method value");
    switch (method) {
      case "execSync": {
        if (args.length != 3 && args.length != 4)
          return ERROR(
            'wrong # args: should be "node:child_process execSync command ?options?"'
          );
        const command = args[2].asString?.();
        if (command == null) return ERROR("invalid command name");
        if (args.length == 4 && args[3].type != ValueType.MAP)
          return ERROR("options must be a map");
        const options = args.length == 4 ? toOptions(args[3] as MapValue) : {};
        try {
          const stdout = child_process.execSync(command, {
            encoding: "utf-8",
            ...options,
          });
          return OK(STR(stdout));
        } catch (e) {
          return ERROR(e.message);
        }
      }
      case "execFileSync": {
        if (args.length < 3 || args.length > 5)
          return ERROR(
            'wrong # args: should be "node:child_process execFileSync file ?args? ?options?"'
          );
        const file = args[2].asString?.();
        if (file == null) return ERROR("invalid file name");
        if (args.length >= 4 && args[3].type != ValueType.TUPLE)
          return ERROR("args must be a tuple");
        if (args.length == 5 && args[4].type != ValueType.MAP)
          return ERROR("options must be a map");
        const fileArgs = [];
        if (args.length >= 4) {
          for (const e of (args[3] as TupleValue).values) {
            fileArgs.push(e.asString?.() ?? "");
          }
        }
        const options = args.length == 5 ? toOptions(args[4] as MapValue) : {};
        try {
          const stdout = child_process.execFileSync(file, fileArgs, {
            encoding: "utf-8",
            ...options,
          });
          return OK(STR(stdout));
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
  cwd: toString,
  input: toString,
  env: toObject,
  uid: toNumber,
  gid: toNumber,
  timeout: toNumber,
  encoding: toString,
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
function toObject(value: Value): object {
  if (!value) return undefined;
  if (value.type != ValueType.MAP) return undefined;
  const obj = {};
  (value as MapValue).map.forEach((value, key) => {
    obj[key] = value.asString?.() ?? "";
  });
  return obj;
}
