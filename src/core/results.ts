/**
 * @file Helena results
 */

import { Value, NIL, STR } from "./values";

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
export const ERROR = (message: string): Result<never> => ({
  code: ResultCode.ERROR,
  value: STR(message),
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

export const RESULT_CODE_NAME = (code: ResultCode | CustomResultCode) => {
  switch (code) {
    case ResultCode.OK:
      return "ok";
    case ResultCode.RETURN:
      return "return";
    case ResultCode.YIELD:
      return "yield";
    case ResultCode.ERROR:
      return "error";
    case ResultCode.BREAK:
      return "break";
    case ResultCode.CONTINUE:
      return "continue";
    default:
      return (code as CustomResultCode).name;
  }
};
/* eslint-enable jsdoc/require-jsdoc */
