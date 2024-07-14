/**
 * @file Helena results
 */

import { ErrorStack } from "./errors";
import { Value, NIL, STR } from "./values";

/** Helena standard result codes */
export enum ResultCode {
  OK,
  RETURN,
  YIELD,
  ERROR,
  BREAK,
  CONTINUE,
  CUSTOM,
}

/** Helena custom result code */
export interface CustomResultCode {
  /** Custom code name */
  name: string;
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
export const ERROR_STACK = (
  message: string,
  errorStack: ErrorStack
): Result => ({
  code: ResultCode.ERROR,
  value: STR(message),
  data: errorStack,
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
  code: ResultCode.CUSTOM,
  value,
  data: code,
});

export const RESULT_CODE_NAME = (result: Result) => {
  switch (result.code) {
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
    case ResultCode.CUSTOM:
      return (result.data as CustomResultCode).name;

    default:
      throw new Error("CANTHAPPEN");
  }
};
/* eslint-enable jsdoc/require-jsdoc */

/**
 * Predicate for CustomResultCode
 *
 * @param result     - Object to test
 * @param customType - Custom result code to match
 * @returns            Whether result code is a custom code of the given type
 */
export function isCustomResult(
  result: Result,
  customType: CustomResultCode
): boolean {
  return (
    result.code == ResultCode.CUSTOM &&
    (result.data as CustomResultCode) == customType
  );
}
