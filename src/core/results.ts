/**
 * @file Helena results
 */

import { Value, NIL, StringValue } from "./values";

/** Helena result codes */
export enum ResultCode {
  OK,
  YIELD,
  RETURN,
  ERROR,
  BREAK,
  CONTINUE,
}

/** Helena result */
export type Result = {
  /** Result code */
  readonly code: ResultCode;

  /** Result value */
  readonly value: Value;

  /** Resumable state */
  readonly state?: unknown;
};

/**
 * Convenience methods for results
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
export const ERROR = (message: string): Result => {
  return { code: ResultCode.ERROR, value: new StringValue(message) };
};
export const BREAK = (value: Value = NIL): Result => {
  return { code: ResultCode.BREAK, value };
};
export const CONTINUE = (value: Value = NIL): Result => {
  return { code: ResultCode.CONTINUE, value };
};
/* eslint-enable jsdoc/require-jsdoc */
