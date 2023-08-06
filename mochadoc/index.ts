/**
 * @file Mochadoc entry point
 */

import { Documentation } from "./types";
import {
  addBlock,
  setSummary,
  markAsSection,
  addMetainfo,
  addTestContent,
} from "./writer";

/**
 * Define a new Mocha suite as a section
 *
 * @param title - Suite title
 * @param fn    - Suite body
 *
 * @returns       Suite function
 */
export function section(title: string, fn: (this: Mocha.Suite) => void) {
  return describe(title, function (this: Mocha.Suite) {
    markAsSection(this);
    return fn.call(this);
  });
}
// eslint-disable-next-line jsdoc/require-jsdoc
section.only = (title: string, fn: (this: Mocha.Suite) => void) => {
  return describe.only(title, function (this: Mocha.Suite) {
    return fn.call(this);
  });
};
// eslint-disable-next-line jsdoc/require-jsdoc
section.skip = (title: string, fn: (this: Mocha.Suite) => void) => {
  return describe.skip(title, function (this: Mocha.Suite) {
    return fn.call(this);
  });
};

/**
 * Add metainformation to the current Mocha suite
 *
 * @param metainfo - Metainformation
 */
export function meta(metainfo) {
  before("mochadoc.meta", function () {
    addMetainfo(this.test.parent, metainfo);
  });
}

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

/**
 * Add a documentation block to the current Mocha test
 *
 * @param context - Current test context
 * @param content - Test content
 */
export function testContent(context: Mocha.Context, content: Documentation) {
  addTestContent(context.test as Mocha.Test, content);
}
