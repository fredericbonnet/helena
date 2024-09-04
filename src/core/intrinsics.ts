/**
 * @file Helena intrinsic commands
 */

import { Command } from "./commands";
import { ERROR, Result } from "./results";

/** Intrinsic command */
class IntrinsicCommand implements Command {
  /* eslint-disable-next-line jsdoc/require-jsdoc */
  execute(): Result {
    return ERROR("intrinsic command cannot be called directly");
  }
}

/** Return the last result of the current program */
export const LAST_RESULT = new IntrinsicCommand();

/**
 * Get the result of the last frame of the current program, shift it right, and
 * evaluate the sentence again.
 */
export const SHIFT_LAST_FRAME_RESULT = new IntrinsicCommand();
