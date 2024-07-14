/**
 * @file Helena errors
 */

import { Source, SourcePosition } from "./source";
import { Value } from "./values";

/** Helena error stack level */
export type ErrorStackLevel = {
  /** Frame where the error occurred */
  frame?: Value[];

  /** Source where the error occurred */
  source?: Source;

  /** Position where the error occurred */
  position?: SourcePosition;
};

/**
 * Helena error stack
 *
 * This class is used to propagate error info with results
 */
export class ErrorStack {
  /** Error stack from its occurrence to its callers */
  private readonly stack: ErrorStackLevel[] = [];

  /**
   * Get depth of the stack, i.e. number of levels
   *
   * @returns Stack depth
   */
  depth() {
    return this.stack.length;
  }

  /**
   * Push an error stack level
   *
   * @param level - Error stack level
   */
  push(level: ErrorStackLevel) {
    this.stack.push(level);
  }

  /**
   * Clear the error stack
   */
  clear() {
    this.stack.length = 0;
  }

  /**
   * Get the given error stack level
   *
   * @param level - Level index to get
   *
   * @returns       Error stack level
   */
  level(level: number): ErrorStackLevel {
    return this.stack[level];
  }
}
