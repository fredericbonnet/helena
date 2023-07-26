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
   * Provided arguments will be validated
   *
   * @param args      - Argument values (can be partial)
   * @param [skip]    - Number of leading arguments to skip
   * @param [context] - Opaque context
   *
   * @returns           Validation result
   */
  help?(args: Value[], skip?: number, context?: unknown): Result;
}
