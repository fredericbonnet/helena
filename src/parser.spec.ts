import { expect } from "chai";
import {
  BlockSyllable,
  CommandSyllable,
  ListSyllable,
  LiteralSyllable,
  Parser,
  Script,
} from "./parser";
import { Tokenizer } from "./tokenizer";

const toTree = (script: Script) =>
  script.commands.map((command) =>
    command.words.map((word) =>
      word.syllables.map((syllable) => {
        if (syllable instanceof LiteralSyllable) {
          return { LITERAL: syllable.value };
        }
        if (syllable instanceof ListSyllable) {
          return { LIST: toTree(syllable.value) };
        }
        if (syllable instanceof BlockSyllable) {
          return { BLOCK: toTree(syllable.value) };
        }
        if (syllable instanceof CommandSyllable) {
          return { COMMAND: toTree(syllable.value) };
        }
        throw new Error("TODO");
      })
    )
  );

describe("Parser", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("scripts", () => {
    specify("empty script", () => {
      const tokens = tokenizer.tokenize("");
      const script = parser.parse(tokens);
      expect(script.commands).to.be.empty;
    });
    specify("blank lines", () => {
      const tokens = tokenizer.tokenize(" \n\n    \n");
      const script = parser.parse(tokens);
      expect(script.commands).to.be.empty;
    });
    specify("single command", () => {
      const tokens = tokenizer.tokenize("command");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([[[{ LITERAL: "command" }]]]);
    });
    specify("single command surrounded by blank lines", () => {
      const tokens = tokenizer.tokenize("  \ncommand\n  ");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([[[{ LITERAL: "command" }]]]);
    });
    specify("two commands separated by newline", () => {
      const tokens = tokenizer.tokenize("command1\ncommand2");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "command1" }]],
        [[{ LITERAL: "command2" }]],
      ]);
    });
    specify("two commands separated by semicolon", () => {
      const tokens = tokenizer.tokenize("command1;command2");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "command1" }]],
        [[{ LITERAL: "command2" }]],
      ]);
    });
  });
  describe("words", () => {
    describe("literals", () => {
      specify("single literal", () => {
        const tokens = tokenizer.tokenize("word");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LITERAL: "word" }]]]);
      });
      specify("single literal surrounded by spaces", () => {
        const tokens = tokenizer.tokenize(" word ");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LITERAL: "word" }]]]);
      });
      specify("single literal with escape sequences", () => {
        const tokens = tokenizer.tokenize("one\\tword");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LITERAL: "one\tword" }]]]);
      });
      specify("two literals separated by whitespace", () => {
        const tokens = tokenizer.tokenize("word1 word2");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LITERAL: "word1" }], [{ LITERAL: "word2" }]],
        ]);
      });
      specify("two literals separated by continuation", () => {
        const tokens = tokenizer.tokenize("word1\\\nword2");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LITERAL: "word1" }], [{ LITERAL: "word2" }]],
        ]);
      });
    });
    describe("lists", () => {
      specify("empty list", () => {
        const tokens = tokenizer.tokenize("()");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LIST: [] }]]]);
      });
      specify("list with one word", () => {
        const tokens = tokenizer.tokenize("(word)");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LIST: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("list with two levels", () => {
        const tokens = tokenizer.tokenize("(word1 (subword1 subword2) word2)");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                LIST: [
                  [
                    [{ LITERAL: "word1" }],
                    [
                      {
                        LIST: [
                          [
                            [{ LITERAL: "subword1" }],
                            [{ LITERAL: "subword2" }],
                          ],
                        ],
                      },
                    ],
                    [{ LITERAL: "word2" }],
                  ],
                ],
              },
            ],
          ],
        ]);
      });
      describe("exceptions", () => {
        specify("unterminated list", () => {
          const tokens = tokenizer.tokenize("(");
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched left parenthesis"
          );
        });
        specify("unmatched right parenthesis", () => {
          const tokens = tokenizer.tokenize(")");
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched right parenthesis"
          );
        });
      });
    });
    describe("blocks", () => {
      specify("empty block", () => {
        const tokens = tokenizer.tokenize("{}");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ BLOCK: [] }]]]);
      });
      specify("block with one word", () => {
        const tokens = tokenizer.tokenize("{word}");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ BLOCK: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("block with two levels", () => {
        const tokens = tokenizer.tokenize("{word1 {subword1 subword2} word2}");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                BLOCK: [
                  [
                    [{ LITERAL: "word1" }],
                    [
                      {
                        BLOCK: [
                          [
                            [{ LITERAL: "subword1" }],
                            [{ LITERAL: "subword2" }],
                          ],
                        ],
                      },
                    ],
                    [{ LITERAL: "word2" }],
                  ],
                ],
              },
            ],
          ],
        ]);
      });
      describe("exceptions", () => {
        specify("unterminated block", () => {
          const tokens = tokenizer.tokenize("{");
          expect(() => parser.parse(tokens)).to.throws("unmatched left brace");
        });
        specify("unmatched right brace", () => {
          const tokens = tokenizer.tokenize("}");
          expect(() => parser.parse(tokens)).to.throws("unmatched right brace");
        });
      });
    });
    describe("commands", () => {
      specify("empty command", () => {
        const tokens = tokenizer.tokenize("[]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                COMMAND: [],
              },
            ],
          ],
        ]);
      });
      specify("command with one word", () => {
        const tokens = tokenizer.tokenize("[word]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ COMMAND: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("command with two levels", () => {
        const tokens = tokenizer.tokenize("[word1 [subword1 subword2] word2]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                COMMAND: [
                  [
                    [{ LITERAL: "word1" }],
                    [
                      {
                        COMMAND: [
                          [
                            [{ LITERAL: "subword1" }],
                            [{ LITERAL: "subword2" }],
                          ],
                        ],
                      },
                    ],
                    [{ LITERAL: "word2" }],
                  ],
                ],
              },
            ],
          ],
        ]);
      });
      describe("exceptions", () => {
        specify("unterminated command", () => {
          const tokens = tokenizer.tokenize("[");
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched left bracket"
          );
        });
        specify("unmatched right bracket", () => {
          const tokens = tokenizer.tokenize("]");
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched right bracket"
          );
        });
      });
    });
    describe("compound words", () => {
      describe("variable names", () => {
        describe("generic selectors", () => {
          specify("generic selector, single", () => {
            const tokens = tokenizer.tokenize("name{selector}");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [[{ LITERAL: "name" }, { BLOCK: [[[{ LITERAL: "selector" }]]] }]],
            ]);
          });
          specify("generic selector, multiple", () => {
            const tokens = tokenizer.tokenize("name{selector1 selector2}");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { LITERAL: "name" },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector1" }], [{ LITERAL: "selector2" }]],
                    ],
                  },
                ],
              ],
            ]);
            specify("generic selectors, chained", () => {
              const tokens = tokenizer.tokenize(
                "name{selector1}{selector2 selector3}{selector4}"
              );
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    { LITERAL: "name" },
                    { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                    {
                      BLOCK: [
                        [
                          [{ LITERAL: "selector2" }],
                          [{ LITERAL: "selector3" }],
                        ],
                      ],
                    },
                    { BLOCK: [[[{ LITERAL: "selector4" }]]] },
                  ],
                ],
              ]);
            });
          });
        });
        describe("keyed selectors", () => {
          specify("keyed selector, single", () => {
            const tokens = tokenizer.tokenize("name(key)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [[{ LITERAL: "name" }, { LIST: [[[{ LITERAL: "key" }]]] }]],
            ]);
          });
          specify("keyed selector, multiple", () => {
            const tokens = tokenizer.tokenize("name(key1 key2)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { LITERAL: "name" },
                  { LIST: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                ],
              ],
            ]);
          });
          specify("keyed selectors, chained", () => {
            const tokens = tokenizer.tokenize("name(key1)(key2 key3)(key4)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { LITERAL: "name" },
                  { LIST: [[[{ LITERAL: "key1" }]]] },
                  { LIST: [[[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]]] },
                  { LIST: [[[{ LITERAL: "key4" }]]] },
                ],
              ],
            ]);
          });
        });
        specify("mixed selectors", () => {
          const tokens = tokenizer.tokenize(
            "name(key1 key2){selector1}(key3){selector2 selector3}"
          );
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                { LITERAL: "name" },
                { LIST: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                { LIST: [[[{ LITERAL: "key3" }]]] },
                {
                  BLOCK: [
                    [[{ LITERAL: "selector2" }], [{ LITERAL: "selector3" }]],
                  ],
                },
              ],
            ],
          ]);
        });
        specify("nested selectors", () => {
          const tokens = tokenizer.tokenize("name1(key1 name2{selector1})");
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                { LITERAL: "name1" },
                {
                  LIST: [
                    [
                      [{ LITERAL: "key1" }],
                      [
                        { LITERAL: "name2" },
                        { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                      ],
                    ],
                  ],
                },
              ],
            ],
          ]);
        });
      });
    });
  });
});
