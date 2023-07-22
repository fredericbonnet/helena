/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { OK, ResultCode } from "../core/results";
import { Command } from "../core/command";
import { RealValue, STR } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { numberToValue } from "./numbers";

const ADD_SIGNATURE = "+ number ?number ...?";
export const addCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR(ADD_SIGNATURE);
    let total = 0;
    for (let i = 1; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      const operand = result.data;
      total += operand;
    }
    return OK(numberToValue(total));
  },
  help: () => {
    return OK(STR(ADD_SIGNATURE));
  },
};

const SUBTRACT_SIGNATURE = "- number ?number ...?";
export const subtractCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR(SUBTRACT_SIGNATURE);
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(numberToValue(-first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total -= result.data;
    }
    return OK(numberToValue(total));
  },
  help: () => {
    return OK(STR(SUBTRACT_SIGNATURE));
  },
};

const MULTIPLY_SIGNATURE = "* number ?number ...?";
export const multiplyCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR(MULTIPLY_SIGNATURE);
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(numberToValue(first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total *= result.data;
    }
    return OK(numberToValue(total));
  },
  help: () => {
    return OK(STR(MULTIPLY_SIGNATURE));
  },
};

const DIVIDE_SIGNATURE = "/ number number ?number ...?";
export const divideCmd: Command = {
  execute: (args) => {
    if (args.length < 3) return ARITY_ERROR(DIVIDE_SIGNATURE);
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total /= result.data;
    }
    return OK(numberToValue(total));
  },
  help: () => {
    return OK(STR(DIVIDE_SIGNATURE));
  },
};

export function registerMathCommands(scope: Scope) {
  scope.registerNamedCommand("+", addCmd);
  scope.registerNamedCommand("-", subtractCmd);
  scope.registerNamedCommand("*", multiplyCmd);
  scope.registerNamedCommand("/", divideCmd);
}
