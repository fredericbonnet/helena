/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/commands";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  INT,
  LIST,
  ListValue,
  STR,
  TUPLE,
  Value,
  ValueType,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";
import { valueToArray } from "./lists";
import { EnsembleCommand } from "./ensembles";

class TupleCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = scope.newChildScope();
    const [, argspec] = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return valueToTuple(args[1]);
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const TUPLE_LENGTH_SIGNATURE = "tuple value length";
const tupleLength: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(TUPLE_LENGTH_SIGNATURE);
    const [result, values] = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(INT(values.length));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(TUPLE_LENGTH_SIGNATURE);
    return OK(STR(TUPLE_LENGTH_SIGNATURE));
  },
};

const TUPLE_AT_SIGNATURE = "tuple value at index ?default?";
const tupleAtCmd: Command = {
  execute(args) {
    if (args.length != 3 && args.length != 4)
      return ARITY_ERROR(TUPLE_AT_SIGNATURE);
    const [result, values] = valueToArray(args[1]);
    if (result.code != ResultCode.OK) return result;
    return ListValue.at(values, args[2], args[3]);
  },
  help(args) {
    if (args.length > 4) return ARITY_ERROR(TUPLE_AT_SIGNATURE);
    return OK(STR(TUPLE_AT_SIGNATURE));
  },
};

export function valueToTuple(value: Value): Result {
  switch (value.type) {
    case ValueType.TUPLE:
      return OK(value);
    case ValueType.LIST:
    case ValueType.SCRIPT: {
      const [result, values] = valueToArray(value);
      if (result.code != ResultCode.OK) return result;
      return OK(TUPLE(values));
    }
    default:
      return ERROR("invalid tuple");
  }
}

export function registerTupleCommands(scope: Scope) {
  const command = new TupleCommand(scope);
  scope.registerNamedCommand("tuple", command);
  command.scope.registerNamedCommand("length", tupleLength);
  command.scope.registerNamedCommand("at", tupleAtCmd);
}
