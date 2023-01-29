/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  IntegerValue,
  ListValue,
  StringValue,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { valueToArray } from "./lists";
import { EnsembleValue } from "./ensembles";

class TupleCommand implements Command {
  scope: Scope;
  ensemble: EnsembleValue;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(
      new ListValue([new StringValue("value")])
    );
    this.ensemble = new EnsembleValue(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.ensemble);
    if (args.length == 2) return valueToTuple(args[1]);
    return this.ensemble.ensemble.execute(args, scope);
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
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR("tuple value at index ?default?");
    const { data: values, ...result } = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return ListValue.at(values, args[2], args[3]);
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
