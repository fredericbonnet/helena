/**
 * @file Helena value display
 */

import { Tokenizer, TokenType } from "./tokenizer";

/** Value display function */
export type DisplayFunction = (displayable: Displayable) => string;

/* eslint-disable-next-line */
/** Default display function */
export const defaultDisplayFunction: DisplayFunction = (_displayable) =>
  undisplayableValue();

/**
 * Undisplayable values are represented as a block comment within a block.
 *
 * @param label - Label to use in block comment
 *
 * @returns       String
 */
export const undisplayableValue = (label = "undisplayable value"): string =>
  `{#{${label}}#}`;

/**
 * Helena displayable object
 *
 * A displayable value will produce a string that, when evaluated as a word,
 * will give a value that is isomorphic with the source value.
 *
 * Undisplayable values will use a placeholder.
 */
export interface Displayable {
  /**
   * Get displayable value
   *
   * @param fn - Display function for undisplayable objects
   *
   * @returns    Displayable string
   */
  display?(fn?: DisplayFunction): string;
}

/**
 * Display an object by dispatching to its `display()` function if it exists,
 * else use the provided function.
 *
 * @param displayable - Object to display
 * @param fn          - Display function for undisplayable objects
 *
 * @returns             Displayable string
 */
export function display(
  displayable: Displayable,
  fn: DisplayFunction = defaultDisplayFunction
): string {
  return displayable.display?.(fn) ?? fn(displayable);
}

/**
 * Display a string as a single literal or as a quoted string if the string
 * contains special characters
 *
 * @param str - String to display
 *
 * @returns     Displayable string
 */
export function displayLiteralOrString(str: string) {
  const tokenizer = new Tokenizer();
  const tokens = tokenizer.tokenize(str);
  if (tokens.length == 0) return `""`;
  if (tokens.length == 1 && tokens[0].type == TokenType.TEXT)
    return tokens[0].literal;
  return `"${str.replaceAll(/[\\$"({[]/g, (c) => "\\" + c)}"`;
}

/**
 * Display a string as a single literal or as a block if the string contains
 * special characters
 *
 * Mostly used to display qualified value sources
 *
 * @param str - String to display
 *
 * @returns     Displayable string
 */
export function displayLiteralOrBlock(str: string) {
  const tokenizer = new Tokenizer();
  const tokens = tokenizer.tokenize(str);
  if (tokens.length == 0) return `{}`;
  if (tokens.length == 1 && tokens[0].type == TokenType.TEXT)
    return tokens[0].literal;
  return `{${str.replaceAll(/[\\$"#(){}[\]]/g, (c) => "\\" + c)}}`;
}

/**
 * Display a list of objects
 *
 * Useful for sentences, tuples expressions, lists...
 *
 * @param displayables - Objects to display
 * @param fn           - Display function for undisplayable objects
 *
 * @returns              Displayable string
 */
export function displayList(
  displayables: Displayable[],
  fn: DisplayFunction = defaultDisplayFunction
): string {
  return `${displayables
    .map((displayable) => display(displayable, fn))
    .join(" ")}`;
}
