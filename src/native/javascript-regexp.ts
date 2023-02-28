/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { DisplayFunction, undisplayableValue } from "../core/display";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  BOOL,
  CustomValueType,
  INT,
  IntegerValue,
  LIST,
  DICT,
  NIL,
  STR,
  StringValue,
  Value,
} from "../core/values";

const asString = (value) => StringValue.toString(value).data;

export const regexpValueType: CustomValueType = { name: "javascript:RegExp" };
export class RegExpValue implements Value {
  readonly type = regexpValueType;
  readonly regexp: RegExp;
  constructor(value: RegExp) {
    this.regexp = value;
  }

  display(fn?: DisplayFunction): string {
    if (fn) return fn(this);
    return undisplayableValue(`RegExp ${this.regexp}`);
  }
}

export const regexpCmd: Command = {
  execute: function (args: Value[]): Result {
    if (args.length < 2) {
      return ERROR('wrong # args: should be "RegExp method ?arg ...?"');
    }
    const method = asString(args[1]);
    if (method == null) return ERROR("invalid method name");
    switch (method) {
      case "new":
        if (args.length < 3 || args.length > 4) {
          return ERROR('wrong # args: should be "RegExp new pattern ?flags?"');
        }
        try {
          const pattern = asString(args[2]);
          if (pattern == null) return ERROR("invalid pattern value");
          if (args.length == 3) {
            return OK(new RegExpValue(new RegExp(pattern)));
          }
          const flags = asString(args[3]);
          if (flags == null) return ERROR("invalid flags value");
          return OK(new RegExpValue(new RegExp(pattern, flags)));
        } catch (e) {
          return ERROR(e.message);
        }
      case "exec": {
        if (args.length != 4)
          return ERROR('wrong # args: should be "RegExp exec regexp str"');
        if (args[2].type != regexpValueType)
          return ERROR("invalid regexp value");
        const { data: str, ...result } = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const regexp = args[2] as RegExpValue;
        const matches = regexp.regexp.exec(str);
        if (!matches) return OK(NIL);
        const map = {
          matches: TO_LIST(STR)(matches),
          index: INT(matches.index),
          input: args[3],
          groups: matches.groups ? TO_MAP(STR)(matches.groups) : NIL,
        };
        if (matches["indices"]) {
          map["indices"] = TO_LIST(TO_LIST(INT))(matches["indices"]);
          map["indices.groups"] = TO_MAP(TO_LIST(INT))(
            matches["indices"].groups
          );
        }
        return OK(DICT(map));
      }
      case "test": {
        if (args.length != 4)
          return ERROR('wrong # args: should be "RegExp test regexp str"');
        if (args[2].type != regexpValueType)
          return ERROR("invalid regexp value");
        const { data: str, ...result } = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const regexp = args[2] as RegExpValue;
        const test = regexp.regexp.test(str);
        return OK(BOOL(test));
      }
      case "lastIndex": {
        if (args.length != 3 && args.length != 4)
          return ERROR(
            'wrong # args: should be "RegExp lastIndex regexp ?value?"'
          );
        if (args[2].type != regexpValueType)
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        if (args.length == 4) {
          const { data: index, ...result } = IntegerValue.toInteger(args[3]);
          if (result.code != ResultCode.OK) return result;
          regexp.regexp.lastIndex = index;
        }
        return OK(INT(regexp.regexp.lastIndex));
      }
      default:
        return ERROR(`unknown method "${method}"`);
    }
  },
};

const TO_LIST = (fn) => (a) => LIST(a.map(fn));
const TO_MAP = (fn) => (m) =>
  DICT(
    Object.fromEntries(
      Object.entries(m).map(([key, value]) => [key, fn(value)])
    )
  );
