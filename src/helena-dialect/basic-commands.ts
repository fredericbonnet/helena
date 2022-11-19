/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  BREAK,
  CONTINUE,
  ERROR,
  OK,
  Result,
  ResultCode,
  RETURN,
  YIELD,
} from "../core/results";
import { Command } from "../core/command";
import { NIL, ScriptValue, TupleValue, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Process, Scope } from "./core";

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
    const body = args[1];
    switch (body.type) {
      case ValueType.SCRIPT:
      case ValueType.TUPLE: {
        return RETURN(new DeferredValue(body, scope));
      }
      default:
        return ERROR("body must be a script or tuple");
    }
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
    const body = args[1];
    switch (body.type) {
      case ValueType.SCRIPT: {
        const state = scope.prepareScriptValue(body as ScriptValue);
        return executeEvalBody(state);
      }
      case ValueType.TUPLE: {
        const state = scope.prepareTupleValue(body as TupleValue);
        return executeEvalBody(state);
      }
      default:
        return ERROR("body must be a script or tuple");
    }
  },
  resume(result: Result): Result {
    const process = result.data as Process;
    process.yieldBack(result.value);
    return executeEvalBody(process);
  },
};
const executeEvalBody = (process: Process): Result => {
  const result = process.run();
  if (result.code == ResultCode.YIELD) return YIELD(result.value, process);
  return result;
};
