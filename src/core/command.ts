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
}
