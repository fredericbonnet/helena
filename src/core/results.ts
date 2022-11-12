/**
 * @file Helena results
 */

import { Value, NIL, StringValue } from "./values";

/** Helena result codes */
export enum ResultCode {
  OK,
  RETURN,
  TAILCALL,
  YIELD,
  ERROR,
  BREAK,
  CONTINUE,
}

/** Helena result */
export type Result<T = unknown> = {
  /** Result code */
  readonly code: ResultCode;

  /** Result value */
  readonly value: Value;

  /** Extra data */
  readonly data?: T;
};

/**
 * Convenience functions for results
 */

/* eslint-disable jsdoc/require-jsdoc */
export const OK = <T = unknown>(value: Value, data?: T): Result<T> => {
  return { code: ResultCode.OK, value, data };
};
export const RETURN = (value: Value = NIL): Result => {
  return { code: ResultCode.RETURN, value };
};
export const TAILCALL = (value: Value, context?): Result => {
  return { code: ResultCode.TAILCALL, value, data: context };
};
export const YIELD = (value: Value = NIL, state?): Result => {
  return { code: ResultCode.YIELD, value, data: state };
};
export const YIELD_BACK = (result: Result, value: Value): Result => {
  return { ...result, value };
};
export const ERROR = (message: string): Result<never> => {
  return { code: ResultCode.ERROR, value: new StringValue(message) };
};
export const BREAK = (value: Value = NIL): Result => {
  return { code: ResultCode.BREAK, value };
};
export const CONTINUE = (value: Value = NIL): Result => {
  return { code: ResultCode.CONTINUE, value };
};
/* eslint-enable jsdoc/require-jsdoc */
