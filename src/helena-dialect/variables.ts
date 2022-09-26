/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command } from "../core/command";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

export const letCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 3:
        return scope.setConstant(args[1].asString(), args[2]);
      default:
        return ARITY_ERROR("let constname value");
    }
  },
});
export const setCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 3:
        return scope.setVariable(args[1].asString(), args[2]);
      default:
        return ARITY_ERROR("set varname value");
    }
  },
});
export const getCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 2:
        return scope.getVariable(args[1].asString());
      default:
        return ARITY_ERROR("get varname");
    }
  },
});
