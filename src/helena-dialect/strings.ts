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
import { EnsembleValue } from "./ensembles";

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "string value1 ${operator} value2"`);

class StringCommand implements Command {
  scope: Scope;
  ensemble: EnsembleValue;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleValue(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.ensemble);
    if (args.length == 2) return StringValue.fromValue(args[1]);
    return this.ensemble.ensemble.execute(args, scope);
  }
  help(args) {
    // TODO handle args to ensemble subcommands
    return OK(STR("string ?value? ?subcommand? ?arg ...?"));
  }
}

const stringLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("string value length");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT(str.length));
  },
};
const stringAtCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR("string value at index ?default?");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    return StringValue.at(str, args[2], args[3]);
  },
};
const stringRangeCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR("string value range first ?last?");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const firstResult = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const first = firstResult.data;
    if (args.length == 3) {
      return OK(STR(str.substring(first)));
    } else {
      const lastResult = IntegerValue.toInteger(args[3]);
      if (lastResult.code != ResultCode.OK) return lastResult;
      const last = lastResult.data;
      if (first >= str.length || last < first || last < 0) return OK(STR(""));
      return OK(STR(str.substring(first, last + 1)));
    }
  },
};
const stringAppendCmd: Command = {
  execute(args) {
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    let str2 = str;
    for (let i = 2; i < args.length; i++) {
      const { data: append, ...result } = StringValue.toString(args[i]);
      if (result.code != ResultCode.OK) return result;
      str2 += append;
    }
    return OK(STR(str2));
  },
};
const stringRemoveCmd: Command = {
  execute(args) {
    if (args.length != 4 && args.length != 5)
      return ARITY_ERROR("string value remove first last");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const firstResult = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const first = firstResult.data;
    const lastResult = IntegerValue.toInteger(args[3]);
    if (lastResult.code != ResultCode.OK) return lastResult;
    const last = lastResult.data;
    const head = str.substring(0, first);
    const tail = str.substring(Math.max(first, last + 1));
    return OK(STR(head + tail));
  },
};
const stringInsertCmd: Command = {
  execute(args) {
    if (args.length != 4) return ARITY_ERROR("string value insert index new");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const indexResult = IntegerValue.toInteger(args[2]);
    if (indexResult.code != ResultCode.OK) return indexResult;
    const index = indexResult.data;
    const { data: insert, ...result2 } = StringValue.toString(args[3]);
    if (result2.code != ResultCode.OK) return result2;
    const head = str.substring(0, index);
    const tail = str.substring(index);
    return OK(STR(head + insert + tail));
  },
};
const stringReplaceCmd: Command = {
  execute(args) {
    if (args.length != 5)
      return ARITY_ERROR("string value replace first last new");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    const firstResult = IntegerValue.toInteger(args[2]);
    if (firstResult.code != ResultCode.OK) return firstResult;
    const first = firstResult.data;
    const lastResult = IntegerValue.toInteger(args[3]);
    if (lastResult.code != ResultCode.OK) return lastResult;
    const last = lastResult.data;
    const head = str.substring(0, first);
    const tail = str.substring(Math.max(first, last + 1));
    const { data: insert, ...result2 } = StringValue.toString(args[4]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(STR(head + insert + tail));
  },
};

const binaryCmd = (
  name: string,
  whenEqual: boolean,
  fn: (op1: string, op2: string) => boolean
): Command => ({
  execute(args: Value[]): Result {
    if (args.length != 3) return OPERATOR_ARITY_ERROR(name);
    if (args[1] == args[2]) return OK(BOOL(whenEqual));
    const { data: operand1, ...result1 } = StringValue.toString(args[1]);
    if (result1.code != ResultCode.OK) return result1;
    const { data: operand2, ...result2 } = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(BOOL(fn(operand1, operand2)));
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
