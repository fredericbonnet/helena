/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, Command } from "../core/command";
import { Value, ValueType, IntegerValue, NumberValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

export const numberCmd = {
  execute(args: Value[]): Result {
    const operand1 = valueToNumber(args[0]);
    if (args.length == 1) return OK(numberToValue(operand1));
    throw new Error("TODO implement infix operators"); // TODO
  },
};

export const addCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("+ arg ?arg ...?");
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 0;
      const v = NumberValue.fromValue(arg).value;
      return total + v;
    }, 0);
    return OK(numberToValue(result));
  },
});

export const subtractCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("- arg ?arg ...?");
    if (args.length == 2) {
      const v = NumberValue.fromValue(args[1]).value;
      return OK(numberToValue(-v));
    }
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 0;
      const v = NumberValue.fromValue(arg).value;
      if (i == 1) return v;
      return total - v;
    }, 0);
    return OK(numberToValue(result));
  },
});

export const multiplyCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("* arg ?arg ...?");
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 1;
      const v = NumberValue.fromValue(arg).value;
      return total * v;
    }, 1);
    return OK(numberToValue(result));
  },
});

export const divideCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 3) return ARITY_ERROR("/ arg arg ?arg ...?");
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 1;
      const v = NumberValue.fromValue(arg).value;
      if (i == 1) return v;
      return total / v;
    }, 0);
    return OK(numberToValue(result));
  },
});

export function isNumberValue(value: Value) {
  return !isNaN(Number(value.asString()));
}
function valueToNumber(value: Value) {
  if (value.type == ValueType.INTEGER) return (value as IntegerValue).value;
  if (value.type == ValueType.NUMBER) return (value as NumberValue).value;
  return Number(value.asString());
}
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
