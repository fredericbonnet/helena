/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode, YIELD } from "../core/results";
import {
  IntegerValue,
  ListValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Scope } from "./core";
import { valueToArray } from "./lists";
import { NamespaceValueCommand } from "./namespaces";

class TupleCommand implements Command {
  scope: Scope;
  namespace: NamespaceValueCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    this.namespace = new NamespaceValueCommand(this.scope);
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.namespace.value);
    if (args.length == 2) return valueToTuple(args[1]);
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

const tupleLength: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR("tuple value length");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(new IntegerValue(values.length));
  },
};
const tupleAtCmd: Command = {
  execute(args) {
    if (args.length != 3) return ARITY_ERROR("tuple value at index");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return ListValue.at(values, args[2]);
  },
};

export function valueToTuple(value: Value): Result {
  switch (value.type) {
    case ValueType.TUPLE:
      return OK(value);
    case ValueType.LIST:
    case ValueType.SCRIPT: {
      const { data: values, ...result } = valueToArray(value);
      if (result.code != ResultCode.OK) return result;
      return OK(new TupleValue(values));
    }
    default:
      return ERROR("invalid tuple");
  }
}

export function registerTupleCommands(scope: Scope) {
  const command = new TupleCommand(scope);
  scope.registerCommand("tuple", command);
  command.scope.registerCommand("length", tupleLength);
  command.scope.registerCommand("at", tupleAtCmd);
}
