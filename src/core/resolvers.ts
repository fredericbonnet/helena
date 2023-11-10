/**
 * @file Helena resolvers
 */

import { Value } from "./values";
import { Command } from "./command";
import { Selector } from "./selectors";
import { Result } from "./results";

/**
 * Variable resolver
 */
export interface VariableResolver {
  /**
   * Resolve a value from its name
   *
   * @param name - Name to resolve
   *
   * @returns      Resolved value
   */
  resolve(name: string): Value;
}

/**
 * Command resolver
 */
export interface CommandResolver {
  /**
   * Resolve a command from its name
   *
   * @param name - Name to resolve
   *
   * @returns      Resolved command
   */
  resolve(name: Value): Command;
}

/**
 * Selector resolver
 */
export interface SelectorResolver {
  /**
   * Resolve a selector from a set of rules
   *
   * @param rules - Rules to resolve
   *
   * @returns       Resolved selector
   */
  resolve(rules: Value[]): Result<Selector>;
}
