/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, Result, ResultCode, OK } from "../core/results";
import { Value, NumberValue, TRUE, FALSE, IntegerValue } from "../core/values";

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "operand1 ${operator} operand2"`);

export const numberCmd = {
  execute(args: Value[]): Result {
    const result = NumberValue.toNumber(args[0]);
    if (result.code != ResultCode.OK) return result;
    const operand1 = result.data;
    if (args.length == 1) return OK(numberToValue(operand1));
    const method = args[1].asString();
    switch (method) {
      case "==":
        return eqOp(args, operand1);
      case "!=":
        return neOp(args, operand1);
      case ">":
        return gtOp(args, operand1);
      case ">=":
        return geOp(args, operand1);
      case "<":
        return ltOp(args, operand1);
      case "<=":
        return leOp(args, operand1);
      // TODO arithmetic operators
      default:
        return ERROR(`invalid method name "${method}"`);
    }
  },
};

const binaryOp =
  (
    operator: string,
    whenEqual: boolean,
    fn: (op1: number, op2: number) => boolean
  ) =>
  (args: Value[], operand1: number): Result => {
    if (args.length != 3) return OPERATOR_ARITY_ERROR(operator);
    if (args[0] == args[2]) return OK(whenEqual ? TRUE : FALSE);
    const result = NumberValue.toNumber(args[2]);
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

export function numberToValue(num: number) {
  return Number.isSafeInteger(num)
    ? new IntegerValue(num)
    : new NumberValue(num);
}
