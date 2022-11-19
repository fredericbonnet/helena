/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { BREAK, CONTINUE, ERROR, OK, RETURN, YIELD } from "../core/results";
import { Command } from "../core/command";
import { NIL } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Scope } from "./core";

export const idemCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("idem value");
    return OK(args[1]);
  },
};

export const returnCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("return ?result?");
    return RETURN(args.length == 2 ? args[1] : NIL);
  },
};

export const yieldCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("yield ?result?");
    return YIELD(args.length == 2 ? args[1] : NIL);
  },
};

export const tailcallCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR("tailcall body");
    return RETURN(new DeferredValue(args[1], scope));
  },
};

export const errorCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("error message");
    return ERROR(args[1].asString());
  },
};

export const breakCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("break");
    return BREAK();
  },
};

export const continueCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("continue");
    return CONTINUE();
  },
};

export const evalCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR("eval body");
    return YIELD(new DeferredValue(args[1], scope));
  },
};
