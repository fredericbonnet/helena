/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  BOOL,
  INT,
  IntegerValue,
  LIST,
  STR,
  StringValue,
  Value,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { EnsembleCommand } from "./ensembles";

class StringCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = scope.newChildScope();
    const [, argspec] = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return StringValue.fromValue(args[1])[0];
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const STRING_LENGTH_SIGNATURE = "string value length";
const stringLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(STRING_LENGTH_SIGNATURE);
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT(str.length));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(STRING_LENGTH_SIGNATURE);
    return OK(STR(STRING_LENGTH_SIGNATURE));
  },
};

const STRING_AT_SIGNATURE = "string value at index ?default?";
const stringAtCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR(STRING_AT_SIGNATURE);
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    return StringValue.at(str, args[2], args[3]);
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(STRING_AT_SIGNATURE);
    return OK(STR(STRING_AT_SIGNATURE));
  },
};

const STRING_RANGE_SIGNATURE = "string value range first ?last?";
const stringRangeCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR(STRING_RANGE_SIGNATURE);
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [firstResult, first] = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    if (args.length == 3) {
      return OK(STR(str.substring(first)));
    } else {
      const [lastResult, last] = IntegerValue.toInteger(args[3]);
      if (lastResult.code != ResultCode.OK) return lastResult;
      if (first >= str.length || last < first || last < 0) return OK(STR(""));
      return OK(STR(str.substring(first, last + 1)));
    }
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(STRING_RANGE_SIGNATURE);
    return OK(STR(STRING_RANGE_SIGNATURE));
  },
};

const STRING_APPEND_SIGNATURE = "string value append ?string ...?";
const stringAppendCmd: Command = {
  execute(args) {
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    let str2 = str;
    for (let i = 2; i < args.length; i++) {
      const [result, append] = StringValue.toString(args[i]);
      if (result.code != ResultCode.OK) return result;
      str2 += append;
    }
    return OK(STR(str2));
  },
  help() {
    return OK(STR(STRING_APPEND_SIGNATURE));
  },
};

const STRING_REMOVE_SIGNATURE = "string value remove first last";
const stringRemoveCmd: Command = {
  execute(args) {
    if (args.length != 4 && args.length != 5)
      return ARITY_ERROR(STRING_REMOVE_SIGNATURE);
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [firstResult, first] = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const [lastResult, last] = IntegerValue.toInteger(args[3]);
    if (lastResult.code != ResultCode.OK) return lastResult;
    const head = str.substring(0, first);
    const tail = str.substring(Math.max(first, last + 1));
    return OK(STR(head + tail));
  },
  help(args) {
    if (args.length > 5) return ARITY_ERROR(STRING_REMOVE_SIGNATURE);
    return OK(STR(STRING_REMOVE_SIGNATURE));
  },
};

const STRING_INSERT_SIGNATURE = "string value insert index value2";
const stringInsertCmd: Command = {
  execute(args) {
    if (args.length != 4) return ARITY_ERROR(STRING_INSERT_SIGNATURE);
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [indexResult, index] = IntegerValue.toInteger(args[2]);
    if (indexResult.code != ResultCode.OK) return indexResult;
    const [result2, insert] = StringValue.toString(args[3]);
    if (result2.code != ResultCode.OK) return result2;
    const head = str.substring(0, index);
    const tail = str.substring(index);
    return OK(STR(head + insert + tail));
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(STRING_INSERT_SIGNATURE);
    return OK(STR(STRING_INSERT_SIGNATURE));
  },
};

const STRING_REPLACE_SIGNATURE = "string value replace first last value2";
const stringReplaceCmd: Command = {
  execute(args) {
    if (args.length != 5) return ARITY_ERROR(STRING_REPLACE_SIGNATURE);
    const [result, str] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [firstResult, first] = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const [lastResult, last] = IntegerValue.toInteger(args[3]);
    if (lastResult.code != ResultCode.OK) return lastResult;
    const head = str.substring(0, first);
    const tail = str.substring(Math.max(first, last + 1));
    const [result2, insert] = StringValue.toString(args[4]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(STR(head + insert + tail));
  },
  help(args) {
    if (args.length > 5) return ARITY_ERROR(STRING_REPLACE_SIGNATURE);
    return OK(STR(STRING_REPLACE_SIGNATURE));
  },
};

const OPERATOR_SIGNATURE = (operator: string) =>
  `string value1 ${operator} value2`;

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "${OPERATOR_SIGNATURE(operator)}"`);

const binaryCmd = (
  name: string,
  whenEqual: boolean,
  fn: (op1: string, op2: string) => boolean
): Command => ({
  execute(args: Value[]): Result {
    if (args.length != 3) return OPERATOR_ARITY_ERROR(name);
    if (args[1] == args[2]) return OK(BOOL(whenEqual));
    const [result1, operand1] = StringValue.toString(args[1]);
    if (result1.code != ResultCode.OK) return result1;
    const [result2, operand2] = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(BOOL(fn(operand1, operand2)));
  },
  help(args) {
    if (args.length > 3) return OPERATOR_ARITY_ERROR(name);
    return OK(STR(OPERATOR_SIGNATURE(name)));
  },
});
const eqCmd = binaryCmd("==", true, (op1, op2) => op1 == op2);
const neCmd = binaryCmd("!=", false, (op1, op2) => op1 != op2);
const gtCmd = binaryCmd(">", false, (op1, op2) => op1 > op2);
const geCmd = binaryCmd(">=", true, (op1, op2) => op1 >= op2);
const ltCmd = binaryCmd("<", false, (op1, op2) => op1 < op2);
const leCmd = binaryCmd("<=", true, (op1, op2) => op1 <= op2);

export function registerStringCommands(scope: Scope) {
  const command = new StringCommand(scope);
  scope.registerNamedCommand("string", command);
  command.scope.registerNamedCommand("length", stringLengthCmd);
  command.scope.registerNamedCommand("at", stringAtCmd);
  command.scope.registerNamedCommand("range", stringRangeCmd);
  command.scope.registerNamedCommand("append", stringAppendCmd);
  command.scope.registerNamedCommand("remove", stringRemoveCmd);
  command.scope.registerNamedCommand("insert", stringInsertCmd);
  command.scope.registerNamedCommand("replace", stringReplaceCmd);
  command.scope.registerNamedCommand("==", eqCmd);
  command.scope.registerNamedCommand("!=", neCmd);
  command.scope.registerNamedCommand(">", gtCmd);
  command.scope.registerNamedCommand(">=", geCmd);
  command.scope.registerNamedCommand("<", ltCmd);
  command.scope.registerNamedCommand("<=", leCmd);
}
