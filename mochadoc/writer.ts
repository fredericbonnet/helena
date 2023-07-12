import * as fs from "fs";
import * as path from "path";
import * as mocha from "mocha";
import { TSDocParser } from "@microsoft/tsdoc";
import { Documentation } from "./types";
import { frontMatter, listItem, paragraph, sectionTitle } from "./markdown";

const commentRE = /\/\*\*(.|\n|\r)*?\*\//;

const tsdocParser: TSDocParser = new TSDocParser();

/**
 * Mark Mocha suite as section
 *
 * @param suite - Mocha suite to mark as section
 */
export function markAsSection(suite: mocha.Suite) {
  const info = ensureSuiteInfo(suite);
  info.isSection = true;
}

/**
 * Attach summary to Mocha suite
 *
 * @param suite         - Mocha suite to attach documentation to
 * @param documentation - Documentation to attach
 */
export function setSummary(suite: mocha.Suite, documentation: Documentation) {
  const info = ensureSuiteInfo(suite);
  info.summary = documentation;
}

/**
 * Attach documentation block to Mocha suite
 *
 * @param suite   - Mocha suite to attach block to
 * @param title   - Block title or `null`
 * @param content - Block content
 */
export function addBlock(
  suite: mocha.Suite,
  title: string | null,
  content: Documentation
) {
  const info = ensureSuiteInfo(suite);
  info.blocks.push({ title, content });
}

/**
 * Attach documentation block to Mocha test
 *
 * @param test    - Mocha test to attach block to
 * @param content - Block content
 */
export function addTestContent(test: mocha.Test, content: Documentation) {
  const info = ensureTestInfo(test);
  info.blocks.push(content);
}

/**
 * Called by reporter at the beginning of a Mocha suite execution
 *
 * @param suite - Mocha suite
 */
export function openSuite(suite: mocha.Suite) {
  ensureSuiteInfo(suite);
}

/**
 * Called by reporter at the end of a Mocha suite execution
 *
 * Will write all the content to the documentation file
 *
 * @param suite - Mocha suite
 */
export function closeSuite(suite: mocha.Suite) {
  if (isMainSuite(suite)) {
    const fd = createDocFile(suite);
    fs.writeSync(fd, frontMatter({ source: getSuiteSourcePath(suite) }));
    writeSuiteDoc(fd, suite);
    fs.closeSync(fd);
  }
}

/**
 * Called by reporter after a Mocha test completes
 *
 * @param test - Mocha test
 */
export function testResult(test: mocha.Test) {
  ensureTestInfo(test);
}

/**
 * Extract TSDoc comment from source string
 *
 * @param body - Source string
 *
 * @returns      TSDoc content if found
 */
function getTSDocs(body: string) {
  const match = commentRE.exec(body);
  if (!match) return;
  const parserContext = tsdocParser.parseString(match[0]);
  return parserContext.lines.map((line) => line.toString()).join("\n");
}

/**
 * Get string from documentation:
 * - functions are parsed for TSDoc comments
 * - strings are output verbatim
 * - other values are converted to JSON fenced blocks
 *
 * @param documentation - Documentation to get string from
 *
 * @returns               Documentation string
 */
function getDocString(documentation: Documentation) {
  if (typeof documentation == "function") {
    const body = documentation.toString();
    return getTSDocs(body);
  } else if (typeof documentation == "string") {
    return documentation;
  } else {
    return "```json\n" + JSON.stringify(documentation, undefined, 2) + "\n```";
  }
}

/** Documentation block */
interface DocumentationBlock {
  /** Block title (optional) */
  title: string | null;

  /** Block content */
  content: Documentation;
}

/** Info attached to Mocha suites */
interface SuiteInfo {
  /** Suite level */
  level: number;

  /** Section flag */
  isSection?: boolean;

  /** Section level */
  sectionLevel: number;

  /** Suite title */
  title: string;

  /** Suite summary (optional) */
  summary?: Documentation;

  /** Suite content blocks (can be empty) */
  blocks: DocumentationBlock[];
}

/** Info attached to Mocha tests */
interface TestInfo {
  /** Hierarchical level */
  level: number;

  /** Test title */
  title: string;

  /** Success status */
  passed: boolean;

  /** Test content blocks (can be empty) */
  blocks: Documentation[];
}

/** Key used to attach info to Mocha suite and test objects */
const infoKey = Symbol("mochadoc");

/**
 * Return info attached to Mocha suite info, creating it if needed
 *
 * @param suite - Mocha suite
 *
 * @returns       Mocha suite info
 */
function ensureSuiteInfo(suite: mocha.Suite): SuiteInfo {
  if (!suite[infoKey]) {
    suite[infoKey] = {
      level: suite.titlePath().length,
      title: suite.title,
      blocks: [],
    };
  }
  return suite[infoKey];
}

/**
 * Return info attached to Mocha suite info, creating it if needed
 *
 * @param test - Mocha test
 *
 * @returns      Mocha test info
 */
function ensureTestInfo(test: mocha.Test): TestInfo {
  if (!test[infoKey]) {
    test[infoKey] = {
      level: test.titlePath().length,
      title: test.title,
      blocks: [],
    };
  }
  return test[infoKey];
}

/**
 * Test whether the given Mocha suite has any attached content:
 * - summary
 * - blocks
 *
 * @param suite - Mocha suite to test
 *
 * @returns       Predicate result
 */
function hasContent(suite: mocha.Suite) {
  const info = ensureSuiteInfo(suite);
  return !!info.summary || info.blocks.length > 0;
}

/**
 * Test whether the given Mocha suite or any of its subsuite has any attached
 * content:
 * - summary
 * - blocks
 *
 * @param suite - Mocha suite to test
 *
 * @returns       Predicate result
 */
function hasContentOrSubcontent(suite: mocha.Suite) {
  return hasContent(suite) || suite.suites.some(hasContentOrSubcontent);
}

/**
 * Test whether the given Mocha suite is the main one
 *
 * @param suite - Mocha suite to test
 *
 * @returns       Predicate result
 */
function isMainSuite(suite: mocha.Suite) {
  const info = ensureSuiteInfo(suite);
  return info.level == 1;
}

/**
 * Test whether the given Mocha suite should be output as a doc section
 *
 * This is the case for main suites, any suite with attached content, and suites
 * immediately under them
 *
 * @param suite - Mocha suite to test
 *
 * @returns       Predicate result
 */
function isSection(suite: mocha.Suite): boolean {
  return getSectionLevel(suite) > 0;
}

/**
 * Get relative Mocha suite source file path
 *
 * @param suite - Mocha suite
 *
 * @returns       File path
 */
function getSuiteSourcePath(suite: mocha.Suite) {
  return path.relative(process.cwd(), suite.file);
}

/**
 * Convert source file name to the matching documentation file
 *
 * @param src - Source file path
 *
 * @returns     Markdown file path
 */
function sourceToDocPath(src: string) {
  const parsed = path.parse(src);
  const base = parsed.name + ".md";
  return path.join("docs", parsed.dir, base);
}

/**
 * Create the documentation file for a Mocha suite
 *
 * @param suite - Mocha suite
 *
 * @returns       File descriptor
 */
function createDocFile(suite: mocha.Suite) {
  const src = getSuiteSourcePath(suite);
  const filePath = sourceToDocPath(src);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  return fs.openSync(filePath, "w");
}

/**
 * Get section level for Mocha suite
 *
 * Section suites are output as Markdown sections
 *
 * @param suite - Mocha suite
 *
 * @returns       Section level, starting at 1 for topmost
 */
function getSectionLevel(suite: mocha.Suite): number {
  const info = ensureSuiteInfo(suite);
  if (info.sectionLevel >= 0) return info.sectionLevel;

  // Suites are not sections by default (stop condition for recursive calls)
  info.sectionLevel = 0;
  if (
    info.isSection ||
    // Main suites are toplevel sections
    isMainSuite(suite) ||
    // Suites with content in their descendence
    hasContentOrSubcontent(suite)
  ) {
    // The whole chain of parent suites must also be sections, this implies that
    // the section level is the suite level
    info.sectionLevel = info.level;
  }
  return info.sectionLevel;
}

/**
 * Get indent level for Mocha suite
 *
 * Non-section suites are output as indented Markdown blocks
 *
 * @param suite - Mocha suite
 *
 * @returns       Indentation level, starting at 0 for topmost
 */
function getIndentLevel(suite: mocha.Suite) {
  if (isSection(suite)) return 0;
  return getIndentLevel(suite.parent) + 1;
}

/**
 * Write all documentation content for this Mocha suite and above
 *
 * @param fd    - File descriptor
 * @param suite - Mocha suite
 */
function writeSuiteDoc(fd: number, suite: mocha.Suite) {
  const info = ensureSuiteInfo(suite);
  if (isSection(suite)) {
    writeSection(fd, suite);
  } else {
    fs.writeSync(fd, listItem(info.title, getIndentLevel(suite) - 1));
  }
  for (const test of suite.tests) {
    writeTestDoc(fd, test);
  }
  for (const child of suite.suites) {
    writeSuiteDoc(fd, child);
  }
}

/**
 * Write a documentation section
 *
 * @param fd    - File descriptor
 * @param suite - Mocha suite
 */
function writeSection(fd: number, suite: mocha.Suite) {
  const info = ensureSuiteInfo(suite);
  fs.writeSync(fd, sectionTitle(info.title, getSectionLevel(suite)));
  if (info.summary) writeDocContent(fd, info.summary);
  for (const block of info.blocks) {
    if (block.title)
      fs.writeSync(fd, sectionTitle(block.title, info.level + 1));
    writeDocContent(fd, block.content);
  }
}

/**
 * Write a documentation content block
 *
 * @param fd            - File descriptor
 * @param documentation - Documentation to write
 */
function writeDocContent(fd: number, documentation: Documentation) {
  const s = getDocString(documentation);
  if (s) fs.writeSync(fd, paragraph(s));
}

/**
 * Write a test result and documentation
 *
 * Tests are output as bullet list item with a success/failure indicator and any
 * attached doc below
 *
 * @param fd   - File descriptor
 * @param test - Mocha test
 */
function writeTestDoc(fd: number, test: mocha.Test) {
  const passed = test.state == "passed";
  const indentLevel = getIndentLevel(test.parent);
  fs.writeSync(
    fd,
    listItem(
      `${passed ? "✅" : test.pending ? "⏸️" : "❌"} ${test.title}`,
      indentLevel
    )
  );
  const s = getTSDocs(test.body);
  if (s) fs.writeSync(fd, paragraph(s, indentLevel + 1));
  if (!passed && !test.pending && !!test.err)
    fs.writeSync(
      fd,
      paragraph("```\n" + test.err.toString() + "\n```", indentLevel + 1)
    );
  const info = ensureTestInfo(test);
  for (const block of info.blocks) {
    const s = getDocString(block);
    if (s) fs.writeSync(fd, paragraph(s, indentLevel + 1));
  }
}
