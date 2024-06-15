/**
 * @file Helena sources
 */

/**
 * Source descriptor
 */
export type Source = {
  /** Path of file-backed sources */
  readonly filename?: string;

  /** Source content (optional for files) */
  readonly content?: string;
};

/**
 * Position in source
 */
export type SourcePosition = {
  /** Character index (zero-indexed) */
  index: number;

  /** Line number (zero-indexed) */
  line: number;

  /** Column number (zero-indexed) */
  column: number;
};
