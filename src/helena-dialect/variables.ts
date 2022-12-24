/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ERROR, OK, ResultCode } from "../core/results";
import { FALSE, TRUE, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

const letCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 3:
        return scope.setConstant(args[1].asString(), args[2]);
      default:
        return ARITY_ERROR("let constname value");
    }
  },
};
const setCmd: Command = {
  execute: (args, scope: Scope) => {
    switch (args.length) {
      case 3:
        return scope.setVariable(args[1].asString(), args[2]);
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
            return scope.getVariable(args[1].asString());
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
            return scope.getVariable(args[1].asString(), args[2]);
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
            return OK(
              scope.resolveValue(args[1]).code == ResultCode.OK ? TRUE : FALSE
            );
          }
          default:
            return OK(
              scope.getVariable(args[1].asString()).code == ResultCode.OK
                ? TRUE
                : FALSE
            );
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
        return scope.unsetVariable(args[1].asString());
      default:
        return ARITY_ERROR("unset varname");
    }
  },
};

export function registerVariableCommands(scope: Scope) {
  scope.registerCommand("let", letCmd);
  scope.registerCommand("set", setCmd);
  scope.registerCommand("get", getCmd);
  scope.registerCommand("exists", existsCmd);
  scope.registerCommand("unset", unsetCmd);
}
