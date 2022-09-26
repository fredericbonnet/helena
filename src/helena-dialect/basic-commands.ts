/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, OK, RETURN, YIELD } from "../core/command";
import { NIL } from "../core/values";
import { ARITY_ERROR } from "./arguments";

export const idemCmd = (): Command => ({
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("idem value");
    return OK(args[1]);
  },
});

export const returnCmd = (): Command => ({
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("return ?result?");
    return RETURN(args.length == 2 ? args[1] : NIL);
  },
});

export const yieldCmd = (): Command => ({
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("yield ?result?");
    return YIELD(args.length == 2 ? args[1] : NIL);
  },
});
