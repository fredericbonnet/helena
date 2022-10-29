/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, Command, ERROR } from "../core/command";
import { Value, IntegerValue, NumberValue, TRUE, FALSE } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

const NUMBER_ERROR = (value: Value) =>
  ERROR(`invalid number "${value.asString()}"`);

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "operand1 ${operator} operand2"`);

export const numberCmd = {
  execute(args: Value[]): Result {
    const operand1 = NumberValue.toNumber(args[0]);
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
    if (!NumberValue.isNumber(args[2])) return NUMBER_ERROR(args[2]);
    const operand2 = NumberValue.toNumber(args[2]);
    return OK(fn(operand1, operand2) ? TRUE : FALSE);
  };
const eqOp = binaryOp("==", true, (op1, op2) => op1 == op2);
const neOp = binaryOp("!=", false, (op1, op2) => op1 != op2);
const gtOp = binaryOp(">", false, (op1, op2) => op1 > op2);
const geOp = binaryOp(">=", true, (op1, op2) => op1 >= op2);
const ltOp = binaryOp("<", false, (op1, op2) => op1 < op2);
const leOp = binaryOp("<=", true, (op1, op2) => op1 <= op2);

export const addCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("+ arg ?arg ...?");
    let total = 0;
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      if (!NumberValue.isNumber(arg)) return NUMBER_ERROR(arg);
      total += NumberValue.toNumber(arg);
    }
    return OK(numberToValue(total));
  },
};

export const subtractCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("- arg ?arg ...?");
    if (!NumberValue.isNumber(args[1])) return NUMBER_ERROR(args[1]);
    const first = NumberValue.toNumber(args[1]);
    if (args.length == 2) {
      return OK(numberToValue(-first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if (!NumberValue.isNumber(arg)) return NUMBER_ERROR(arg);
      total -= NumberValue.toNumber(arg);
    }
    return OK(numberToValue(total));
  },
};

export const multiplyCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("* arg ?arg ...?");
    if (!NumberValue.isNumber(args[1])) return NUMBER_ERROR(args[1]);
    const first = NumberValue.toNumber(args[1]);
    if (args.length == 2) {
      return OK(numberToValue(first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if (!NumberValue.isNumber(arg)) return NUMBER_ERROR(arg);
      total *= NumberValue.toNumber(arg);
    }
    return OK(numberToValue(total));
  },
};

export const divideCmd: Command = {
  execute: (args) => {
    if (args.length < 3) return ARITY_ERROR("/ arg arg ?arg ...?");
    if (!NumberValue.isNumber(args[1])) return NUMBER_ERROR(args[1]);
    const first = NumberValue.toNumber(args[1]);
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const arg = args[i];
      if (!NumberValue.isNumber(arg)) return NUMBER_ERROR(arg);
      total /= NumberValue.toNumber(arg);
    }
    return OK(numberToValue(total));
  },
};

function numberToValue(num: number) {
  return Number.isSafeInteger(num)
    ? new IntegerValue(num)
    : new NumberValue(num);
}

export function registerMathCommands(scope: Scope) {
  scope.registerCommand("+", addCmd);
  scope.registerCommand("-", subtractCmd);
  scope.registerCommand("*", multiplyCmd);
  scope.registerCommand("/", divideCmd);
}
