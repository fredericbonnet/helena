/**
 * @file Markdown generation
 */

/**
 * Generate Markdown front matter
 *
 * @param content - Key-value map
 *
 * @returns         Markdown string
 */
export function frontMatter(content: { [key: string]: string }) {
  return `---
${Object.entries(content)
  .map(([key, value]) => `${key}: ${value}`)
  .join("\n")}
---
`;
}

/**
 * Generate Markdown section title
 *
 * @param title - Section title text
 * @param level - Section level
 *
 * @returns       Markdown string
 */
export function sectionTitle(title: string, level: number) {
  return paragraph(`${"#".repeat(level)} ${title}`);
}

/**
 * Generate Markdown paragraph
 *
 * @param paragraph   - Paragraph text
 * @param indentLevel - Indentation level
 *
 * @returns             Markdown string
 */
export function paragraph(paragraph: string, indentLevel?: number) {
  const indent = "  ".repeat(indentLevel);
  const text = indentLevel
    ? paragraph
        .split("\n")
        .map((line) => indent + line)
        .join("\n")
    : paragraph;
  return text + "\n\n";
}

/**
 * Generate Markdown bullet list item
 *
 * @param text        - Item text
 * @param indentLevel - Indentation level
 *
 * @returns             Markdown string
 */
export function listItem(text: string, indentLevel?: number) {
  return paragraph(`- ${text}`, indentLevel);
}
