/**
 * Documentation block:
 * - functions are parsed for TSDoc comments
 * - strings are output verbatim
 * - other values are converted to JSON fenced blocks
 */
export type Documentation = (() => void) | string | unknown;
