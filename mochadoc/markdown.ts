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
 * Indent Markdown text
 *
 * @param text        - Text
 * @param indentLevel - Indentation level
 *
 * @returns             Markdown string
 */
export function indent(text: string, indentLevel?: number) {
  const indent = "  ".repeat(indentLevel);
  return indentLevel > 0
    ? text
        .split("\n")
        .map((line) => indent + line)
        .join("\n")
    : text;
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
  return indent(paragraph, indentLevel) + "\n\n";
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
  return indent(`- ${text}`, indentLevel) + "\n";
}

/**
 * Generate Markdown link
 *
 * @param text - Link text
 * @param url  - Link URL
 *
 * @returns      Markdown string
 */
export function link(text: string, url: string) {
  return `[${text}](${url})`;
}

/**
 * Generate Markdown anchor
 *
 * @param id - Anchor ID
 *
 * @returns    Markdown string
 */
export function anchor(id: string) {
  return `<a id="${id}"></a>`;
}
