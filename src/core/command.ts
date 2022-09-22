/**
 * @file Helena commands
 */

import { NIL, Value } from "./values";

/** Supported command result codes */
export enum ResultCode {
  OK,
  YIELD,
  RETURN,
  BREAK,
  CONTINUE,
  ERROR,
}

/** Helena command result */
export type Result = {
  /** Result code */
  readonly code: ResultCode;

  /** Result value */
  readonly value: Value;
};

/**
 * Convenience methods for OK results
 */

/* eslint-disable jsdoc/require-jsdoc */
export const OK = (value: Value): Result => {
  return { code: ResultCode.OK, value };
};
export const YIELD = (value: Value): Result => {
  return { code: ResultCode.YIELD, value };
};
export const RETURN = (value: Value): Result => {
  return { code: ResultCode.RETURN, value };
};
export const BREAK = (value: Value = NIL): Result => {
  return { code: ResultCode.BREAK, value };
};
export const CONTINUE = (value: Value = NIL): Result => {
  return { code: ResultCode.CONTINUE, value };
};
export const ERROR = (value: Value): Result => {
  return { code: ResultCode.ERROR, value };
};
/* eslint-enable jsdoc/require-jsdoc */

/** Helena command */
export interface Command {
  /**
   * Execute the command
   *
   * @param args - Argument values
   *
   * @returns      Command result
   */
  execute(args: Value[]): Result;

  /**
   * Resume the previously yielded command
   *
   * @param value - Value to yield back
   *
   * @returns       Command result
   */
  resume?(value: Value): Result;
}
