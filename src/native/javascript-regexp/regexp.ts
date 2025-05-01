/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../../core/commands";
import { DisplayFunction, undisplayableValue } from "../../core/display";
import { ERROR, OK, Result, ResultCode } from "../../core/results";
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
  CustomValue,
  ValueType,
  isCustomValue,
} from "../../core/values";

const asString = (value) => StringValue.toString(value)[1];

export const regexpValueType: CustomValueType = { name: "javascript:RegExp" };
export class RegExpValue implements CustomValue {
  readonly type = ValueType.CUSTOM;
  readonly customType = regexpValueType;

  readonly regexp: RegExp;
  constructor(value: RegExp) {
    this.regexp = value;
  }

  display(fn?: DisplayFunction): string {
    if (fn) return fn(this);
    return undisplayableValue(`RegExp ${this.regexp}`);
  }
}

//
// Javascript RegExp wrapper
//
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
//

export const regexpCmd: Command = {
  execute: function (args: Value[]): Result {
    if (args.length < 2) {
      return ERROR('wrong # args: should be "RegExp method ?arg ...?"');
    }
    const method = asString(args[1]);
    if (method == null) return ERROR("invalid method name");
    switch (method) {
      //
      // Constructor
      //
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#constructor
      //

      case "new":
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/RegExp
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

      //
      // Instance methods
      //
      // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp#instance_methods
      //

      case "exec": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/exec
        if (args.length != 4)
          return ERROR('wrong # args: should be "RegExp exec regexp str"');
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const regexp = args[2] as RegExpValue;
        const matches = regexp.regexp.exec(str);
        if (!matches) return OK(NIL);
        return OK(MATCHES_TO_DICT(matches));
      }

      case "test": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/test
        if (args.length != 4)
          return ERROR('wrong # args: should be "RegExp test regexp str"');
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const regexp = args[2] as RegExpValue;
        const test = regexp.regexp.test(str);
        return OK(BOOL(test));
      }

      case "toString": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/toString
        if (args.length != 3)
          return ERROR('wrong # args: should be "RegExp toString regexp"');
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        return OK(STR(regexp.regexp.toString()));
      }

      case "Symbol.match": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.match
        if (args.length != 4)
          return ERROR(
            'wrong # args: should be "RegExp Symbol.match regexp str"'
          );
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const matches = regexp.regexp[Symbol.match](str);
        if (!matches) return OK(NIL);
        return OK(MATCHES_TO_DICT(matches));
      }

      case "Symbol.matchAll": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.matchAll
        if (args.length != 4)
          return ERROR(
            'wrong # args: should be "RegExp Symbol.matchAll regexp str"'
          );
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const matches = Array.from(
          regexp.regexp[Symbol.matchAll](str),
          MATCHES_TO_DICT
        );
        return OK(LIST(matches));
      }

      case "Symbol.replace": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.replace
        if (args.length != 5)
          return ERROR(
            'wrong # args: should be "RegExp Symbol.replace regexp str replacement"'
          );
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const [result2, replacement] = StringValue.toString(args[4]);
        if (result2.code != ResultCode.OK) return result2;
        const replaced = regexp.regexp[Symbol.replace](str, replacement);
        return OK(STR(replaced));
      }

      case "Symbol.search": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.search
        if (args.length != 4)
          return ERROR(
            'wrong # args: should be "RegExp Symbol.search regexp str"'
          );
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        const index = regexp.regexp[Symbol.search](str);
        return OK(INT(index));
      }

      case "Symbol.split": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/Symbol.split
        if (args.length != 4 && args.length != 5)
          return ERROR(
            'wrong # args: should be "RegExp Symbol.split regexp str ?limit?"'
          );
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        const [result, str] = StringValue.toString(args[3]);
        if (result.code != ResultCode.OK) return result;
        if (args.length == 5) {
          const [result2, limit] = IntegerValue.toInteger(args[4]);
          if (result2.code != ResultCode.OK) return result2;
          const split = regexp.regexp[Symbol.split](str, limit);
          return OK(LIST(split.map(STR)));
        }
        const split = regexp.regexp[Symbol.split](str);
        return OK(LIST(split.map(STR)));
      }

      //
      // Instance properties
      //

      case "lastIndex": {
        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp/lastIndex
        if (args.length != 3 && args.length != 4)
          return ERROR(
            'wrong # args: should be "RegExp lastIndex regexp ?value?"'
          );
        if (!isCustomValue(args[2], regexpValueType))
          return ERROR("invalid regexp value");
        const regexp = args[2] as RegExpValue;
        if (args.length == 4) {
          const [result, index] = IntegerValue.toInteger(args[3]);
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

const INT_OR_NIL = (v) => (v == undefined || v == null ? NIL : INT(v));
const STR_OR_NIL = (v) => (v == undefined || v == null ? NIL : STR(v));
const TO_LIST = (fn) => (a) => LIST(a.map(fn));
const TO_DICT = (fn) => (m) =>
  DICT(
    Object.fromEntries(
      Object.entries(m)
        .filter(([, value]) => value != undefined)
        .map(([key, value]) => [key, fn(value)])
    )
  );
const MATCHES_TO_DICT = (matches: RegExpExecArray | RegExpMatchArray) => {
  const map = {
    matches: TO_LIST(STR_OR_NIL)(matches),
    index: INT_OR_NIL(matches.index),
    input: STR_OR_NIL(matches.input),
    groups: matches.groups ? TO_DICT(STR_OR_NIL)(matches.groups) : NIL,
  };
  if (matches["indices"]) {
    map["indices"] = TO_LIST(TO_LIST(INT))(matches["indices"]);
    map["indices.groups"] = TO_DICT(TO_LIST(INT))(matches["indices"].groups);
  }
  return DICT(map);
};
