/**
 * @file Mochadoc entry point
 */

import { Documentation } from "./types";
import { addBlock, setSummary } from "./writer";

/**
 * Set summary for the current Mocha suite
 *
 * There can be at most one summary per suite, which will be output immediately
 * after the suite title
 *
 * @param content - Summary content
 */
export function summary(content: Documentation) {
  before("mochadoc.summary", function () {
    setSummary(this.test.parent, content);
  });
}

/**
 * Add a documentation block to the current Mocha suite
 *
 * Blocks are output in order after the suite title and summary
 *
 * @param title   - Optional block title
 * @param content - Block content
 */
export function block(title: string | null, content: Documentation) {
  before("mochadoc.block", function () {
    addBlock(this.test.parent, title, content);
  });
}

/**
 * Add a usage section to the current Mocha suite
 *
 * @param content - Section content
 */
export function usage(content: Documentation) {
  block("Usage", content);
}

/**
 * Add a description block to the current Mocha suite
 *
 * @param content - Section content
 */
export function description(content: Documentation) {
  block(null, content);
}
