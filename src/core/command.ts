/**
 * @file Helena commands
 */

import { Value } from "./values";

/** Supported command result codes */
export enum ResultCode {
  OK,
  RETURN,
  BREAK,
  CONTINUE,
  ERROR,
}

/** Helena command result */
export type Result = [ResultCode, Value];

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
}
