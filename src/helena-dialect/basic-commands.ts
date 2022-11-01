/* eslint-disable jsdoc/require-jsdoc */ // TODO
/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { OK, Result, ResultCode, RETURN, YIELD } from "../core/results";
import { Command } from "../core/command";
import { Program, Process } from "../core/compiler";
import { NIL, ScriptValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

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

type EvalBodyState = {
  program: Program;
  process: Process;
};
export const evalCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 2) return ARITY_ERROR("eval body");
    const body = args[1];
    const program = scope.compile((body as ScriptValue).script);
    const process = new Process();
    return executeEvalBody({ program, process }, scope);
  },
  resume(result: Result, scope: Scope): Result {
    return executeEvalBody(result.data as EvalBodyState, scope);
  },
};
const executeEvalBody = (state: EvalBodyState, scope: Scope): Result => {
  const result = scope.execute(state.program, state.process);

  if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
  return result;
};
