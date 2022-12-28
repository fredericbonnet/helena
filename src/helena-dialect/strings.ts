/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode, YIELD } from "../core/results";
import {
  FALSE,
  IntegerValue,
  StringValue,
  TRUE,
  TupleValue,
  Value,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Scope } from "./core";
import { NamespaceValueCommand } from "./namespaces";

const OPERATOR_ARITY_ERROR = (operator: string) =>
  ERROR(`wrong # operands: should be "string value1 ${operator} value2"`);

class StringCommand implements Command {
  scope: Scope;
  namespace: NamespaceValueCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    this.namespace = new NamespaceValueCommand(this.scope);
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.namespace.value);
    if (args.length == 2) return StringValue.fromValue(args[1]);
    const [, value, subcommand, ...rest] = args;
    if (!this.scope.hasLocalCommand(subcommand.asString()))
      return ERROR(`invalid subcommand name "${subcommand.asString()}"`);
    return YIELD(
      new DeferredValue(
        new TupleValue([subcommand, value, ...rest]),
        this.scope
      )
    );
  }
}

const stringLengthCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("string value length");
    const { data: str, ...result } = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(new IntegerValue(str.length));
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
      return OK(new StringValue(str.substring(first)));
    } else {
      const lastResult = IntegerValue.toInteger(args[3]);
      if (lastResult.code != ResultCode.OK) return lastResult;
      const last = lastResult.data;
      if (first >= str.length || last < first || last < 0)
        return OK(new StringValue(""));
      return OK(new StringValue(str.substring(first, last + 1)));
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
    return OK(new StringValue(str2));
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
    return OK(new StringValue(head + tail));
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
    return OK(new StringValue(head + insert + tail));
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
    return OK(new StringValue(head + insert + tail));
  },
};

const binaryCmd = (
  whenEqual: boolean,
  fn: (op1: string, op2: string) => boolean
): Command => ({
  execute(args: Value[]): Result {
    if (args.length != 3) return OPERATOR_ARITY_ERROR(args[0].asString());
    if (args[1] == args[2]) return OK(whenEqual ? TRUE : FALSE);
    const { data: operand1, ...result1 } = StringValue.toString(args[1]);
    if (result1.code != ResultCode.OK) return result1;
    const { data: operand2, ...result2 } = StringValue.toString(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    return OK(fn(operand1, operand2) ? TRUE : FALSE);
  },
});
const eqCmd = binaryCmd(true, (op1, op2) => op1 == op2);
const neCmd = binaryCmd(false, (op1, op2) => op1 != op2);
const gtCmd = binaryCmd(false, (op1, op2) => op1 > op2);
const geCmd = binaryCmd(true, (op1, op2) => op1 >= op2);
const ltCmd = binaryCmd(false, (op1, op2) => op1 < op2);
const leCmd = binaryCmd(true, (op1, op2) => op1 <= op2);

export function registerStringCommands(scope: Scope) {
  const command = new StringCommand(scope);
  scope.registerCommand("string", command);
  command.scope.registerCommand("length", stringLengthCmd);
  command.scope.registerCommand("at", stringAtCmd);
  command.scope.registerCommand("range", stringRangeCmd);
  command.scope.registerCommand("append", stringAppendCmd);
  command.scope.registerCommand("remove", stringRemoveCmd);
  command.scope.registerCommand("insert", stringInsertCmd);
  command.scope.registerCommand("replace", stringReplaceCmd);
  command.scope.registerCommand("==", eqCmd);
  command.scope.registerCommand("!=", neCmd);
  command.scope.registerCommand(">", gtCmd);
  command.scope.registerCommand(">=", geCmd);
  command.scope.registerCommand("<", ltCmd);
  command.scope.registerCommand("<=", leCmd);
}
