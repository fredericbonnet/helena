/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, Command, ERROR } from "../core/command";
import { Value, IntegerValue, NumberValue, StringValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

const NUMBER_ERROR = (value: Value) =>
  ERROR(new StringValue(`invalid number "${value.asString()}"`));

export const numberCmd = {
  execute(args: Value[]): Result {
    const operand1 = NumberValue.toNumber(args[0]);
    if (args.length == 1) return OK(numberToValue(operand1));
    throw new Error("TODO implement infix operators"); // TODO
  },
};

export const addCmd = (): Command => ({
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
});

export const subtractCmd = (): Command => ({
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
});

export const multiplyCmd = (): Command => ({
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
});

export const divideCmd = (): Command => ({
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
});

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
