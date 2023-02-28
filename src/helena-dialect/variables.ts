/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, ResultCode } from "../core/results";
import { BOOL, FALSE, TupleValue, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

const letCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 3:
        switch (args[1].type) {
          case ValueType.TUPLE:
            return scope.setConstants(args[1] as TupleValue, args[2]);
          default:
            return scope.setConstant(args[1], args[2]);
        }
      default:
        return ARITY_ERROR("let constname value");
    }
  },
};
const setCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 3:
        switch (args[1].type) {
          case ValueType.TUPLE:
            return scope.setVariables(args[1] as TupleValue, args[2]);
          default:
            return scope.setVariable(args[1], args[2]);
        }
      default:
        return ARITY_ERROR("set varname value");
    }
  },
};
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
        return ARITY_ERROR("get varname ?default?");
    }
  },
};
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
        return ARITY_ERROR("exists varname");
    }
  },
};
const unsetCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 2:
        return scope.unsetVariable(args[1]);
      default:
        return ARITY_ERROR("unset varname");
    }
  },
};

export function registerVariableCommands(scope: Scope) {
  scope.registerNamedCommand("let", letCmd);
  scope.registerNamedCommand("set", setCmd);
  scope.registerNamedCommand("get", getCmd);
  scope.registerNamedCommand("exists", existsCmd);
  scope.registerNamedCommand("unset", unsetCmd);
}
