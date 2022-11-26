/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import { FALSE, IntegerValue, StringValue, TRUE, Value } from "../core/values";
import { ARITY_ERROR } from "./arguments";

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "string value1 ${operator} value2"`);

export const stringCmd: Command = {
  execute(args: Value[]): Result {
    if (args.length < 2)
      return ARITY_ERROR("string value ?subcommand? ?arg ...?");
    if (args.length == 2) return StringValue.fromValue(args[1]);
    const result = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const str = result.data;
    const subcommand = args[2];
    switch (subcommand.asString()) {
      case "length":
        if (args.length != 3) return ARITY_ERROR("string value length");
        return OK(new IntegerValue(str.length));
      case "at":
        if (args.length != 4) return ARITY_ERROR("string value at index");
        return StringValue.at(str, args[3]);
      case "range": {
        if (args.length != 4 && args.length != 5)
          return ARITY_ERROR("string value range first ?last?");
        const firstResult = IntegerValue.toInteger(args[3]);
        if (firstResult.code != ResultCode.OK) return firstResult;
        const first = firstResult.data;
        if (args.length == 4) {
          return OK(new StringValue(str.substring(first)));
        } else {
          const lastResult = IntegerValue.toInteger(args[4]);
          if (lastResult.code != ResultCode.OK) return lastResult;
          const last = lastResult.data;
          if (first >= str.length || last < first || last < 0)
            return OK(new StringValue(""));
          return OK(new StringValue(str.substring(first, last + 1)));
        }
      }
      case "append": {
        let str2 = str;
        for (let i = 3; i < args.length; i++) {
          const newResult = StringValue.toString(args[i]);
          if (newResult.code != ResultCode.OK) return newResult;
          str2 += newResult.data;
        }
        return OK(new StringValue(str2));
      }
      case "remove": {
        if (args.length != 5 && args.length != 6)
          return ARITY_ERROR("string value remove first last");
        const firstResult = IntegerValue.toInteger(args[3]);
        if (firstResult.code != ResultCode.OK) return firstResult;
        const first = firstResult.data;
        const lastResult = IntegerValue.toInteger(args[4]);
        if (lastResult.code != ResultCode.OK) return lastResult;
        const last = lastResult.data;
        const head = str.substring(0, first);
        const tail = str.substring(Math.max(first, last + 1));
        return OK(new StringValue(head + tail));
      }
      case "insert": {
        if (args.length != 5)
          return ARITY_ERROR("string value insert index new");
        const indexResult = IntegerValue.toInteger(args[3]);
        if (indexResult.code != ResultCode.OK) return indexResult;
        const index = indexResult.data;
        const newResult = StringValue.toString(args[4]);
        if (newResult.code != ResultCode.OK) return newResult;
        const head = str.substring(0, index);
        const tail = str.substring(index);
        return OK(new StringValue(head + newResult.data + tail));
      }
      case "replace": {
        if (args.length != 6)
          return ARITY_ERROR("string value replace first last new");
        const firstResult = IntegerValue.toInteger(args[3]);
        if (firstResult.code != ResultCode.OK) return firstResult;
        const first = firstResult.data;
        const lastResult = IntegerValue.toInteger(args[4]);
        if (lastResult.code != ResultCode.OK) return lastResult;
        const last = lastResult.data;
        const head = str.substring(0, first);
        const tail = str.substring(Math.max(first, last + 1));
        const newResult = StringValue.toString(args[5]);
        if (newResult.code != ResultCode.OK) return newResult;
        return OK(new StringValue(head + newResult.data + tail));
      }
      case "==":
        return eqOp(args, str);
      case "!=":
        return neOp(args, str);
      case ">":
        return gtOp(args, str);
      case ">=":
        return geOp(args, str);
      case "<":
        return ltOp(args, str);
      case "<=":
        return leOp(args, str);
      default:
        return ERROR(`invalid subcommand name "${subcommand.asString()}"`);
    }
  },
};

const binaryOp =
  (
    operator: string,
    whenEqual: boolean,
    fn: (op1: string, op2: string) => boolean
  ) =>
  (args: Value[], operand1: string): Result => {
    if (args.length != 4) return OPERATOR_ARITY_ERROR(operator);
    if (args[1] == args[3]) return OK(whenEqual ? TRUE : FALSE);
    const result = StringValue.toString(args[3]);
    if (result.code != ResultCode.OK) return result;
    const operand2 = result.data;
    return OK(fn(operand1, operand2) ? TRUE : FALSE);
  };
const eqOp = binaryOp("==", true, (op1, op2) => op1 == op2);
const neOp = binaryOp("!=", false, (op1, op2) => op1 != op2);
const gtOp = binaryOp(">", false, (op1, op2) => op1 > op2);
const geOp = binaryOp(">=", true, (op1, op2) => op1 >= op2);
const ltOp = binaryOp("<", false, (op1, op2) => op1 < op2);
const leOp = binaryOp("<=", true, (op1, op2) => op1 <= op2);
