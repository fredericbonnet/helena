/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, Result, ResultCode } from "../core/results";
import {
  BOOL,
  FALSE,
  NIL,
  STR,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { destructureValue, Scope } from "./core";

const LET_SIGNATURE = "let constname value";
const letCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 3:
        return destructureValue(
          scope.setConstant.bind(scope),
          args[1],
          args[2]
        );
      default:
        return ARITY_ERROR(LET_SIGNATURE);
    }
  },
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(LET_SIGNATURE);
    return OK(STR(LET_SIGNATURE));
  },
};

const SET_SIGNATURE = "set varname value";
const setCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 3:
        return destructureValue(
          scope.setVariable.bind(scope),
          args[1],
          args[2]
        );
      default:
        return ARITY_ERROR(SET_SIGNATURE);
    }
  },
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(SET_SIGNATURE);
    return OK(STR(SET_SIGNATURE));
  },
};

const GET_SIGNATURE = "get varname ?default?";
const getCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 2:
        switch (args[1].type) {
          case ValueType.TUPLE:
          case ValueType.QUALIFIED:
            return scope.resolveValue(args[1]);
          default:
            return scope.getVariable(args[1]);
        }
      case 3:
        switch (args[1].type) {
          case ValueType.TUPLE:
            return ERROR("cannot use default with name tuples");
          case ValueType.QUALIFIED: {
            const result = scope.resolveValue(args[1]);
            if (result.code != ResultCode.OK) return OK(args[2]);
            return scope.resolveValue(args[1]);
          }
          default:
            return scope.getVariable(args[1], args[2]);
        }
      default:
        return ARITY_ERROR(GET_SIGNATURE);
    }
  },
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(GET_SIGNATURE);
    return OK(STR(GET_SIGNATURE));
  },
};

const EXISTS_SIGNATURE = "exists varname";
const existsCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 2:
        switch (args[1].type) {
          case ValueType.TUPLE:
            return ERROR("invalid value");
          case ValueType.QUALIFIED: {
            const result = scope.resolveValue(args[1]);
            if (result.code != ResultCode.OK) return OK(FALSE);
            return OK(BOOL(scope.resolveValue(args[1]).code == ResultCode.OK));
          }
          default:
            return OK(BOOL(scope.getVariable(args[1]).code == ResultCode.OK));
        }
      default:
        return ARITY_ERROR(EXISTS_SIGNATURE);
    }
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(EXISTS_SIGNATURE);
    return OK(STR(EXISTS_SIGNATURE));
  },
};

const UNSET_SIGNATURE = "unset varname";
const unsetCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 2:
        return unset(scope, args[1]);
      default:
        return ARITY_ERROR(UNSET_SIGNATURE);
    }
  },
  help: (args) => {
    if (args.length > 2) return ARITY_ERROR(UNSET_SIGNATURE);
    return OK(STR(UNSET_SIGNATURE));
  },
};

function unset(scope: Scope, name: Value, check = false): Result {
  if (name.type != ValueType.TUPLE) return scope.unsetVariable(name, check);
  const variables = name as TupleValue;
  // First pass for error checking
  for (let i = 0; i < variables.values.length; i++) {
    const result = unset(scope, variables.values[i], true);
    if (result.code != ResultCode.OK) return result;
  }
  if (check) return OK(NIL);
  // Second pass for actual setting
  for (let i = 0; i < variables.values.length; i++) {
    unset(scope, variables.values[i]);
  }
  return OK(NIL);
}

export function registerVariableCommands(scope: Scope) {
  scope.registerNamedCommand("let", letCmd);
  scope.registerNamedCommand("set", setCmd);
  scope.registerNamedCommand("get", getCmd);
  scope.registerNamedCommand("exists", existsCmd);
  scope.registerNamedCommand("unset", unsetCmd);
}
