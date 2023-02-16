/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, Result, ResultCode, OK } from "../core/results";
import { Value, NumberValue, TRUE, FALSE, IntegerValue } from "../core/values";

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "operand1 ${operator} operand2"`);

export const numberCmd = {
  execute(args: Value[]): Result {
    const { data: operand1, ...result } = NumberValue.toNumber(args[0]);
    if (result.code != ResultCode.OK) return result;
    if (args.length == 1) return OK(numberToValue(operand1));
    if (!args[1].asString) return ERROR("invalid subcommand name");
    const subcommand = args[1].asString();
    switch (subcommand) {
      case "+":
      case "-":
      case "*":
      case "/":
        return arithmetics(args, operand1);
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
      default:
        return ERROR(`unknown subcommand "${subcommand}"`);
    }
  },
};

const arithmetics = (args: Value[], operand1: number): Result => {
  if (args.length % 2 == 0)
    return ERROR(
      `wrong # operands: should be "operand ?operator operand? ?...?"`
    );
  let total = 0;
  let last = operand1;
  for (let i = 1; i < args.length; i += 2) {
    if (!args[i].asString) return ERROR(`invalid operator`);
    const operator = args[i].asString();
    switch (operator) {
      case "+": {
        const { data: operator2, ...result } = NumberValue.toNumber(
          args[i + 1]
        );
        if (result.code != ResultCode.OK) return result;
        total += last;
        last = operator2;
        break;
      }
      case "-": {
        const { data: operator2, ...result } = NumberValue.toNumber(
          args[i + 1]
        );
        if (result.code != ResultCode.OK) return result;
        total += last;
        last = -operator2;
        break;
      }
      case "*": {
        const { data: operator2, ...result } = NumberValue.toNumber(
          args[i + 1]
        );
        if (result.code != ResultCode.OK) return result;
        last *= operator2;
        break;
      }
      case "/": {
        const { data: operator2, ...result } = NumberValue.toNumber(
          args[i + 1]
        );
        if (result.code != ResultCode.OK) return result;
        last /= operator2;
        break;
      }
      default:
        return ERROR(`invalid operator "${operator}"`);
    }
  }
  total += last;
  return OK(numberToValue(total));
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
    const { data: operand2, ...result } = NumberValue.toNumber(args[2]);
    if (result.code != ResultCode.OK) return result;
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
