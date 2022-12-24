/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { BREAK, CONTINUE, ERROR, OK, RETURN, YIELD } from "../core/results";
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
    return ERROR(args[1].asString());
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
  scope.registerCommand("idem", idemCmd);
  scope.registerCommand("return", returnCmd);
  scope.registerCommand("tailcall", tailcallCmd);
  scope.registerCommand("yield", yieldCmd);
  scope.registerCommand("error", errorCmd);
  scope.registerCommand("break", breakCmd);
  scope.registerCommand("continue", continueCmd);
  scope.registerCommand("eval", evalCmd);
}
