/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  BREAK,
  CONTINUE,
  ERROR,
  OK,
  ResultCode,
  RETURN,
  YIELD,
} from "../core/results";
import { Command } from "../core/command";
import { NIL } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Scope } from "./core";

const idemCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("idem value");
    return OK(args[1]);
  },
};

const returnCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("return ?result?");
    return RETURN(args.length == 2 ? args[1] : NIL);
  },
};

const yieldCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("yield ?result?");
    return YIELD(args.length == 2 ? args[1] : NIL);
  },
};

const tailcallCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR("tailcall body");
    return RETURN(new DeferredValue(args[1], scope));
  },
};

const errorCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("error message");
    if (args[1].asString?.() == null) return ERROR("invalid message");
    return {
      code: ResultCode.ERROR,
      value: args[1],
    };
  },
};

const breakCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("break");
    return BREAK();
  },
};

const continueCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("continue");
    return CONTINUE();
  },
};

const evalCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR("eval body");
    return YIELD(new DeferredValue(args[1], scope));
  },
};

export function registerBasicCommands(scope: Scope) {
  scope.registerNamedCommand("idem", idemCmd);
  scope.registerNamedCommand("return", returnCmd);
  scope.registerNamedCommand("tailcall", tailcallCmd);
  scope.registerNamedCommand("yield", yieldCmd);
  scope.registerNamedCommand("error", errorCmd);
  scope.registerNamedCommand("break", breakCmd);
  scope.registerNamedCommand("continue", continueCmd);
  scope.registerNamedCommand("eval", evalCmd);
}
