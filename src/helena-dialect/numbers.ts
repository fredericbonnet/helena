/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, Result, ResultCode, OK } from "../core/results";
import {
  Value,
  RealValue,
  INT,
  REAL,
  BOOL,
  LIST,
  STR,
  IntegerValue,
  StringValue,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { EnsembleCommand } from "./ensembles";
import { Subcommands } from "./subcommands";

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "operand1 ${operator} operand2"`);

const numberSubcommands = new Subcommands([
  "subcommands",
  "+",
  "-",
  "*",
  "/",
  "==",
  "!=",
  ">",
  ">=",
  "<",
  "<=",
]);

export const numberCmd = {
  execute(args: Value[]): Result {
    const { data: operand1, ...result } = RealValue.toNumber(args[0]);
    if (result.code != ResultCode.OK) return result;
    if (args.length == 1) return OK(numberToValue(operand1));
    return numberSubcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<number> subcommands");
        return OK(numberSubcommands.list);
      },

      "+": () => arithmetics(args, operand1),
      "-": () => arithmetics(args, operand1),
      "*": () => arithmetics(args, operand1),
      "/": () => arithmetics(args, operand1),

      "==": () => eqOp(args, operand1),
      "!=": () => neOp(args, operand1),
      ">": () => gtOp(args, operand1),
      ">=": () => geOp(args, operand1),
      "<": () => ltOp(args, operand1),
      "<=": () => leOp(args, operand1),
    });
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
    const { data: operator, code } = StringValue.toString(args[i]);
    if (code != ResultCode.OK) return ERROR(`invalid operator`);
    switch (operator) {
      case "+": {
        const { data: operand2, ...result } = RealValue.toNumber(args[i + 1]);
        if (result.code != ResultCode.OK) return result;
        total += last;
        last = operand2;
        break;
      }
      case "-": {
        const { data: operand2, ...result } = RealValue.toNumber(args[i + 1]);
        if (result.code != ResultCode.OK) return result;
        total += last;
        last = -operand2;
        break;
      }
      case "*": {
        const { data: operand2, ...result } = RealValue.toNumber(args[i + 1]);
        if (result.code != ResultCode.OK) return result;
        last *= operand2;
        break;
      }
      case "/": {
        const { data: operand2, ...result } = RealValue.toNumber(args[i + 1]);
        if (result.code != ResultCode.OK) return result;
        last /= operand2;
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
    if (args[0] == args[2]) return OK(BOOL(whenEqual));
    const { data: operand2, ...result } = RealValue.toNumber(args[2]);
    if (result.code != ResultCode.OK) return result;
    return OK(BOOL(fn(operand1, operand2)));
  };
const eqOp = binaryOp("==", true, (op1, op2) => op1 == op2);
const neOp = binaryOp("!=", false, (op1, op2) => op1 != op2);
const gtOp = binaryOp(">", false, (op1, op2) => op1 > op2);
const geOp = binaryOp(">=", true, (op1, op2) => op1 >= op2);
const ltOp = binaryOp("<", false, (op1, op2) => op1 < op2);
const leOp = binaryOp("<=", true, (op1, op2) => op1 <= op2);

export function numberToValue(num: number) {
  return Number.isSafeInteger(num) ? INT(num) : REAL(num);
}

class IntCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return IntegerValue.fromValue(args[1]);
    return this.ensemble.execute(args, scope);
  }
  resume(result: Result): Result {
    return this.ensemble.resume(result);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

class RealCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return RealValue.fromValue(args[1]);
    return this.ensemble.execute(args, scope);
  }
  resume(result: Result): Result {
    return this.ensemble.resume(result);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

export function registerNumberCommands(scope: Scope) {
  const intCommand = new IntCommand(scope);
  scope.registerNamedCommand("int", intCommand);
  const realCommand = new RealCommand(scope);
  scope.registerNamedCommand("real", realCommand);
}
