/**
 * @file Helena commands
 */

import { Value } from "./values";
import { Result } from "./results";

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

  /**
   * Return help for the command and a list of arguments
   *
   * Provided arguments will be validated against the command signature
   *
   * @param args      - Argument values (can be partial)
   * @param [options] - Help formating options
   * @param [context] - Opaque context
   *
   * @returns           Validation result
   */
  help?(
    args: Value[],
    options?: {
      /** Prefix to prepend to the help string */
      prefix?: string;

      /** Leading arguments to skip */
      skip?: number;
    },
    context?: unknown
  ): Result;
}
