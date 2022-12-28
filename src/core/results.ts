/**
 * @file Helena results
 */

import { Value, NIL, StringValue } from "./values";

/** Helena standard result codes */
export enum ResultCode {
  OK,
  RETURN,
  YIELD,
  ERROR,
  BREAK,
  CONTINUE,
}

/** Helena custom result code */
export interface CustomResultCode {
  /** Custom code name */
  name: string;
}

/** Helena result */
export type Result<T = unknown> = {
  /** Result code */
  readonly code: ResultCode | CustomResultCode;

  /** Result value */
  readonly value: Value;

  /** Extra data */
  readonly data?: T;
};

/**
 * Convenience functions for results
 */

/* eslint-disable jsdoc/require-jsdoc */
export const OK = <T = unknown>(value: Value, data?: T): Result<T> => ({
  code: ResultCode.OK,
  value,
  data,
});
export const RETURN = (value: Value = NIL): Result => ({
  code: ResultCode.RETURN,
  value,
});
export const YIELD = (value: Value = NIL, state?): Result => ({
  code: ResultCode.YIELD,
  value,
  data: state,
});
export const YIELD_BACK = (result: Result, value: Value): Result => ({
  ...result,
  value,
});
export const ERROR = (message: string): Result<never> => ({
  code: ResultCode.ERROR,
  value: new StringValue(message),
});
export const BREAK = (value: Value = NIL): Result => ({
  code: ResultCode.BREAK,
  value,
});
export const CONTINUE = (value: Value = NIL): Result => ({
  code: ResultCode.CONTINUE,
  value,
});
export const CUSTOM_RESULT = (
  code: CustomResultCode,
  value: Value = NIL
): Result => ({
  code,
  value,
});
/* eslint-enable jsdoc/require-jsdoc */
