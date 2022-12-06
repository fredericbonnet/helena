/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { OK, ResultCode } from "../core/results";
import { Command } from "../core/command";
import { NumberValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { numberToValue } from "./numbers";

export const addCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("+ arg ?arg ...?");
    let total = 0;
    for (let i = 1; i < args.length; i++) {
      const result = NumberValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      const operand = result.data;
      total += operand;
    }
    return OK(numberToValue(total));
  },
};

export const subtractCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("- arg ?arg ...?");
    const result = NumberValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(numberToValue(-first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = NumberValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total -= result.data;
    }
    return OK(numberToValue(total));
  },
};

export const multiplyCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("* arg ?arg ...?");
    const result = NumberValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(numberToValue(first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = NumberValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total *= result.data;
    }
    return OK(numberToValue(total));
  },
};

export const divideCmd: Command = {
  execute: (args) => {
    if (args.length < 3) return ARITY_ERROR("/ arg arg ?arg ...?");
    const result = NumberValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = NumberValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total /= result.data;
    }
    return OK(numberToValue(total));
  },
};

export function registerMathCommands(scope: Scope) {
  scope.registerCommand("+", addCmd);
  scope.registerCommand("-", subtractCmd);
  scope.registerCommand("*", multiplyCmd);
  scope.registerCommand("/", divideCmd);
}
