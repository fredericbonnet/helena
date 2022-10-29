/**
 * @file Helena commands
 */

import { NIL, StringValue, Value } from "./values";

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

  /** Resumable state */
  readonly state?: unknown;
};

/**
 * Convenience methods for OK results
 */

/* eslint-disable jsdoc/require-jsdoc */
export const OK = (value: Value): Result => {
  return { code: ResultCode.OK, value };
};
export const YIELD = (value: Value = NIL, state?): Result => {
  return { code: ResultCode.YIELD, value, state };
};
export const RETURN = (value: Value = NIL): Result => {
  return { code: ResultCode.RETURN, value };
};
export const BREAK = (value: Value = NIL): Result => {
  return { code: ResultCode.BREAK, value };
};
export const CONTINUE = (value: Value = NIL): Result => {
  return { code: ResultCode.CONTINUE, value };
};
export const ERROR = (message: string): Result => {
  return { code: ResultCode.ERROR, value: new StringValue(message) };
};
/* eslint-enable jsdoc/require-jsdoc */

/** Helena command */
export interface Command {
  /**
   * Execute the command
   *
   * @param args      - Argument values
   * @param [context] - Opaque context
   *
   * @returns           Command result
   */
  execute(args: Value[], context?: unknown): Result;

  /**
   * Resume the previously yielded command
   *
   * @param result    - Result to yield back
   * @param [context] - Opaque context
   *
   * @returns           Command result
   */
  resume?(result: Result, context?: unknown): Result;
}
