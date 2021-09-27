import { expect } from "chai";
import { describe } from "mocha";
import {
  BlockSyllable,
  CommandSyllable,
  HereStringSyllable,
  ListSyllable,
  LiteralSyllable,
  Parser,
  Script,
  StringSyllable,
  Syllable,
  TaggedStringSyllable,
  LineCommentSyllable,
  BlockCommentSyllable,
  SubstituteNextSyllable,
} from "./parser";
import { Tokenizer } from "./tokenizer";

const mapSyllable = (syllable: Syllable) => {
  if (syllable instanceof LiteralSyllable) {
    return { LITERAL: syllable.value };
  }
  if (syllable instanceof ListSyllable) {
    return { LIST: toTree(syllable.subscript) };
  }
  if (syllable instanceof BlockSyllable) {
    return { BLOCK: toTree(syllable.subscript) };
  }
  if (syllable instanceof CommandSyllable) {
    return { COMMAND: toTree(syllable.subscript) };
  }
  if (syllable instanceof StringSyllable) {
    return { STRING: syllable.syllables.map(mapSyllable) };
  }
  if (syllable instanceof HereStringSyllable) {
    return { HERE_STRING: syllable.value };
  }
  if (syllable instanceof TaggedStringSyllable) {
    return { TAGGED_STRING: syllable.value };
  }
  if (syllable instanceof LineCommentSyllable) {
    return { LINE_COMMENT: syllable.value };
  }
  if (syllable instanceof BlockCommentSyllable) {
    return { BLOCK_COMMENT: syllable.value };
  }
  if (syllable instanceof SubstituteNextSyllable) {
    return {
      [syllable.expansion ? "EXPAND_NEXT" : "SUBSTITUTE_NEXT"]:
        syllable.nesting,
    };
  }
  throw new Error("TODO");
};
const toTree = (script: Script) =>
  script.sentences.map((sentence) =>
    sentence.words.map((word) => word.syllables.map(mapSyllable))
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
      expect(script.sentences).to.be.empty;
    });
    specify("blank lines", () => {
      const tokens = tokenizer.tokenize(" \n\n    \n");
      const script = parser.parse(tokens);
      expect(script.sentences).to.be.empty;
    });
    specify("single sentence", () => {
      const tokens = tokenizer.tokenize("sentence");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([[[{ LITERAL: "sentence" }]]]);
    });
    specify("single sentence surrounded by blank lines", () => {
      const tokens = tokenizer.tokenize("  \nsentence\n  ");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([[[{ LITERAL: "sentence" }]]]);
    });
    specify("two sentences separated by newline", () => {
      const tokens = tokenizer.tokenize("sentence1\nsentence2");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "sentence1" }]],
        [[{ LITERAL: "sentence2" }]],
      ]);
    });
    specify("two sentences separated by semicolon", () => {
      const tokens = tokenizer.tokenize("sentence1;sentence2");
      const script = parser.parse(tokens);
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "sentence1" }]],
        [[{ LITERAL: "sentence2" }]],
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
        specify("mismatched right brace", () => {
          const tokens = tokenizer.tokenize("(}");
          expect(() => parser.parse(tokens)).to.throws(
            "mismatched right brace"
          );
        });
        specify("mismatched right bracket", () => {
          const tokens = tokenizer.tokenize("(]");
          expect(() => parser.parse(tokens)).to.throws(
            "mismatched right bracket"
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
        specify("mismatched right parenthesis", () => {
          const tokens = tokenizer.tokenize("{)");
          expect(() => parser.parse(tokens)).to.throws(
            "mismatched right parenthesis"
          );
        });
        specify("mismatched right bracket", () => {
          const tokens = tokenizer.tokenize("{]");
          expect(() => parser.parse(tokens)).to.throws(
            "mismatched right bracket"
          );
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
        specify("mismatched right parenthesis", () => {
          const tokens = tokenizer.tokenize("[)");
          expect(() => parser.parse(tokens)).to.throws(
            "mismatched right parenthesis"
          );
        });
        specify("mismatched right brace", () => {
          const tokens = tokenizer.tokenize("[}");
          expect(() => parser.parse(tokens)).to.throws(
            "mismatched right brace"
          );
        });
      });
    });
    describe("strings", () => {
      specify("empty string", () => {
        const tokens = tokenizer.tokenize('""');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ STRING: [] }]]]);
      });
      specify("simple string", () => {
        const tokens = tokenizer.tokenize('"string"');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "string" }] }]],
        ]);
      });
      specify("longer string", () => {
        const tokens = tokenizer.tokenize('"this is a string"');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "this is a string" }] }]],
        ]);
      });
      specify("string with whitespaces and continuations", () => {
        const tokens = tokenizer.tokenize(
          '"this  \t  is\r\f a   \\\n  \t  string"'
        );
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "this  \t  is\r\f a    string" }] }]],
        ]);
      });
      specify("string with special characters", () => {
        const tokens = tokenizer.tokenize('"this {is (a #string"');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "this {is (a #string" }] }]],
        ]);
      });
      describe("substitutions", () => {
        specify("lone dollar", () => {
          const tokens = tokenizer.tokenize('"$"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([[[{ STRING: [{ LITERAL: "$" }] }]]]);
        });
        specify("simple variable", () => {
          const tokens = tokenizer.tokenize('"$a"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a" }] }]],
          ]);
        });
        specify("Unicode variable name", () => {
          const tokens = tokenizer.tokenize('"$a\u1234"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a\u1234" }] }]],
          ]);
        });
        specify("multiple substitution", () => {
          const tokens = tokenizer.tokenize('"$$a $$$b"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: 2 },
                    { LITERAL: "a" },
                    { LITERAL: " " },
                    { SUBSTITUTE_NEXT: 3 },
                    { LITERAL: "b" },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("expansion", () => {
          const tokens = tokenizer.tokenize('"$*$$*a"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ EXPAND_NEXT: 3 }, { LITERAL: "a" }] }]],
          ]);
        });
        describe("variable name delimiters", () => {
          specify("trailing dollars", () => {
            const tokens = tokenizer.tokenize('"a$ b$*$ c$$*$"');
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [
                      { LITERAL: "a" },
                      { LITERAL: "$ b" },
                      { LITERAL: "$*$ c" },
                      { LITERAL: "$$*$" },
                    ],
                  },
                ],
              ],
            ]);
          });
          specify("escapes", () => {
            const tokens = tokenizer.tokenize("$a\\x62 $c\\d");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a" }, { LITERAL: "b" }],
                [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "c" }, { LITERAL: "d" }],
              ],
            ]);
          });
          specify("special characters", () => {
            const tokens = tokenizer.tokenize("$a# $b*");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a" }, { LITERAL: "#" }],
                [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "b" }, { LITERAL: "*" }],
              ],
            ]);
          });
        });
        describe("selectors", () => {
          describe("generic selectors", () => {
            specify("single", () => {
              const tokens = tokenizer.tokenize('"$name{selector}"');
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        { BLOCK: [[[{ LITERAL: "selector" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("multiple", () => {
              const tokens = tokenizer.tokenize('"$name{selector1 selector2}"');
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        {
                          BLOCK: [
                            [
                              [{ LITERAL: "selector1" }],
                              [{ LITERAL: "selector2" }],
                            ],
                          ],
                        },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("chained", () => {
              const tokens = tokenizer.tokenize(
                '"$name{selector1}{selector2 selector3}{selector4}"'
              );
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
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
                    },
                  ],
                ],
              ]);
            });
          });
          describe("keyed selectors", () => {
            specify("single", () => {
              const tokens = tokenizer.tokenize('"$name(key)"');
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        { LIST: [[[{ LITERAL: "key" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("multiple", () => {
              const tokens = tokenizer.tokenize('"$name(key1 key2)"');
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        {
                          LIST: [
                            [[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]],
                          ],
                        },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("chained", () => {
              const tokens = tokenizer.tokenize(
                '"$name(key1)(key2 key3)(key4)"'
              );
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        { LIST: [[[{ LITERAL: "key1" }]]] },
                        {
                          LIST: [
                            [[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]],
                          ],
                        },
                        { LIST: [[[{ LITERAL: "key4" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
          });
          specify("mixed selectors", () => {
            const tokens = tokenizer.tokenize(
              '"$name(key1 key2){selector1}(key3){selector2 selector3}"'
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [
                      { SUBSTITUTE_NEXT: 1 },
                      { LITERAL: "name" },
                      {
                        LIST: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]],
                      },
                      { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                      { LIST: [[[{ LITERAL: "key3" }]]] },
                      {
                        BLOCK: [
                          [
                            [{ LITERAL: "selector2" }],
                            [{ LITERAL: "selector3" }],
                          ],
                        ],
                      },
                    ],
                  },
                ],
              ],
            ]);
          });
          specify("nested selectors", () => {
            const tokens = tokenizer.tokenize(
              '"$name1(key1 $name2{selector1})"'
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [
                      { SUBSTITUTE_NEXT: 1 },
                      { LITERAL: "name1" },
                      {
                        LIST: [
                          [
                            [{ LITERAL: "key1" }],
                            [
                              { SUBSTITUTE_NEXT: 1 },
                              { LITERAL: "name2" },
                              { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                            ],
                          ],
                        ],
                      },
                    ],
                  },
                ],
              ],
            ]);
          });
        });
      });
      describe("exceptions", () => {
        specify("unterminated string", () => {
          const tokens = tokenizer.tokenize('"');
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched string delimiter"
          );
        });
        specify("extra quotes", () => {
          const tokens = tokenizer.tokenize('"hello""');
          expect(() => parser.parse(tokens)).to.throws(
            "extra characters after string delimiter"
          );
        });
      });
    });
    describe("here-strings", () => {
      specify("3-quote delimiter", () => {
        const tokens = tokenizer.tokenize(
          '"""some " \\\n    $arbitrary [character\n  "" sequence"""'
        );
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                HERE_STRING:
                  'some " \\\n    $arbitrary [character\n  "" sequence',
              },
            ],
          ],
        ]);
      });
      specify("4-quote delimiter", () => {
        const tokens = tokenizer.tokenize('""""here is """ some text""""');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                HERE_STRING: 'here is """ some text',
              },
            ],
          ],
        ]);
      });
      specify("4-quote sequence between 3-quote delimiters", () => {
        const tokens = tokenizer.tokenize(
          '""" <- 3 quotes here / 4 quotes there -> """" / 3 quotes here -> """'
        );
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                HERE_STRING:
                  ' <- 3 quotes here / 4 quotes there -> """" / 3 quotes here -> ',
              },
            ],
          ],
        ]);
      });
      describe("exceptions", () => {
        specify("unterminated here-string", () => {
          const tokens = tokenizer.tokenize('"""hello');
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched here-string delimiter"
          );
        });
        specify("extra quotes", () => {
          const tokens = tokenizer.tokenize(
            '""" <- 3 quotes here / 4 quotes there -> """"'
          );
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched here-string delimiter"
          );
        });
      });
    });
    describe("tagged strings", () => {
      specify("empty tagged string", () => {
        const tokens = tokenizer.tokenize('""EOF\nEOF""');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: "" }]]]);
      });
      specify("single empty line", () => {
        const tokens = tokenizer.tokenize('""EOF\n\nEOF""');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: "\n" }]]]);
      });
      specify("extra characters after open delimiter", () => {
        const tokens = tokenizer.tokenize(
          '""EOF some $arbitrary[ }text\\\n (with continuation\nfoo\nbar\nEOF""'
        );
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: "foo\nbar\n" }]]]);
      });
      specify("tag within string", () => {
        const tokens = tokenizer.tokenize('""EOF\nEOF ""\nEOF""');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: 'EOF ""\n' }]]]);
      });
      specify("continuations", () => {
        const tokens = tokenizer.tokenize('""EOF\nsome\\\n   string\nEOF""');
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ TAGGED_STRING: "some\\\n   string\n" }]],
        ]);
      });
      specify("indentation", () => {
        const tokens = tokenizer.tokenize(`""EOF
          #include <stdio.h>
          
          int main(void) {
            printf("Hello, world!");
            return 0;
          }
          EOF""`);
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                TAGGED_STRING: `#include <stdio.h>

int main(void) {
  printf("Hello, world!");
  return 0;
}
`,
              },
            ],
          ],
        ]);
      });
      specify("line prefix", () => {
        const tokens = tokenizer.tokenize(`""EOF
1  #include <stdio.h>
2  
3  int main(void) {
4    printf("Hello, world!");
5    return 0;
6  }
   EOF""`);
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                TAGGED_STRING: `#include <stdio.h>

int main(void) {
  printf("Hello, world!");
  return 0;
}
`,
              },
            ],
          ],
        ]);
      });
      describe("exceptions", () => {
        specify("unterminated tagged string", () => {
          const tokens = tokenizer.tokenize('""EOF\nhello');
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched tagged string delimiter"
          );
        });
        specify("extra quotes", () => {
          const tokens = tokenizer.tokenize('""EOF\nhello\nEOF"""');
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched tagged string delimiter"
          );
        });
      });
    });
    describe("line comments", () => {
      specify("empty line comment", () => {
        const tokens = tokenizer.tokenize("#");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LINE_COMMENT: "" }]]]);
      });
      specify("simple line comment", () => {
        const tokens = tokenizer.tokenize("# this is a comment");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this is a comment" }]],
        ]);
      });
      specify("line comment with special characters", () => {
        const tokens = tokenizer.tokenize("# this ; is$ (a [comment{");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this ; is$ (a [comment{" }]],
        ]);
      });
      specify("line comment with continuation", () => {
        const tokens = tokenizer.tokenize("# this is\\\na comment");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this is a comment" }]],
        ]);
      });
      specify("line comment with escapes", () => {
        const tokens = tokenizer.tokenize("# hello \\x41\\t");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LINE_COMMENT: " hello A\t" }]]]);
      });
      specify("line comment with multiple hashes", () => {
        const tokens = tokenizer.tokenize("### this is a comment");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this is a comment" }]],
        ]);
      });
    });
    describe("block comments", () => {
      specify("empty block comment", () => {
        const tokens = tokenizer.tokenize("#{}#");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "" }]]]);
      });
      specify("simple block comment", () => {
        const tokens = tokenizer.tokenize("#{comment}#");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "comment" }]]]);
      });
      specify("multiple line block comment", () => {
        const tokens = tokenizer.tokenize("#{\ncomment\n}#");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "\ncomment\n" }]]]);
      });
      specify("block comment with continuation", () => {
        const tokens = tokenizer.tokenize("#{this is\\\na comment}#");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ BLOCK_COMMENT: "this is\\\na comment" }]],
        ]);
      });
      specify("block comment with escapes", () => {
        const tokens = tokenizer.tokenize("#{hello \\x41\\t}#");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ BLOCK_COMMENT: "hello \\x41\\t" }]],
        ]);
      });
      specify("block comment with multiple hashes", () => {
        const tokens = tokenizer.tokenize("##{comment}##");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "comment" }]]]);
      });
      specify("nested block comments", () => {
        const tokens = tokenizer.tokenize("##{comment ##{}##}##");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ BLOCK_COMMENT: "comment ##{}##" }]],
        ]);
      });
      specify("nested block comments with different prefixes", () => {
        const tokens = tokenizer.tokenize("##{comment #{}##");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "comment #{" }]]]);
      });
      describe("exceptions", () => {
        specify("unterminated block comment", () => {
          const tokens = tokenizer.tokenize("#{hello");
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched block comment delimiter"
          );
        });
        specify("extra hashes", () => {
          const tokens = tokenizer.tokenize(
            "#{ <- 1 hash here / 2 hashes there -> }##"
          );
          expect(() => parser.parse(tokens)).to.throws(
            "unmatched block comment delimiter"
          );
        });
      });
    });
    describe("substitutions", () => {
      specify("lone dollar", () => {
        const tokens = tokenizer.tokenize("$");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ LITERAL: "$" }]]]);
      });
      specify("simple variable", () => {
        const tokens = tokenizer.tokenize("$a");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a" }]],
        ]);
      });
      specify("Unicode variable name", () => {
        const tokens = tokenizer.tokenize("$a\u1234");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a\u1234" }]],
        ]);
      });
      specify("multiple substitution", () => {
        const tokens = tokenizer.tokenize("$$a $$$b");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [{ SUBSTITUTE_NEXT: 2 }, { LITERAL: "a" }],
            [{ SUBSTITUTE_NEXT: 3 }, { LITERAL: "b" }],
          ],
        ]);
      });
      specify("expansion", () => {
        const tokens = tokenizer.tokenize("$*$$*a");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ EXPAND_NEXT: 3 }, { LITERAL: "a" }]],
        ]);
      });
      describe("variable name delimiters", () => {
        specify("trailing dollars", () => {
          const tokens = tokenizer.tokenize("a$ b$*$ c$$*$");
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [{ LITERAL: "a" }, { LITERAL: "$" }],
              [{ LITERAL: "b" }, { LITERAL: "$*$" }],
              [{ LITERAL: "c" }, { LITERAL: "$$*$" }],
            ],
          ]);
        });
        specify("escapes", () => {
          const tokens = tokenizer.tokenize("$a\\x62 $c\\d");
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a" }, { LITERAL: "b" }],
              [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "c" }, { LITERAL: "d" }],
            ],
          ]);
        });
        specify("special characters", () => {
          const tokens = tokenizer.tokenize("$a# $b*");
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "a" }, { LITERAL: "#" }],
              [{ SUBSTITUTE_NEXT: 1 }, { LITERAL: "b" }, { LITERAL: "*" }],
            ],
          ]);
        });
      });
      describe("selectors", () => {
        describe("generic selectors", () => {
          specify("single", () => {
            const tokens = tokenizer.tokenize("$name{selector}");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { BLOCK: [[[{ LITERAL: "selector" }]]] },
                ],
              ],
            ]);
          });
          specify("multiple", () => {
            const tokens = tokenizer.tokenize("$name{selector1 selector2}");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector1" }], [{ LITERAL: "selector2" }]],
                    ],
                  },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const tokens = tokenizer.tokenize(
              "$name{selector1}{selector2 selector3}{selector4}"
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector2" }], [{ LITERAL: "selector3" }]],
                    ],
                  },
                  { BLOCK: [[[{ LITERAL: "selector4" }]]] },
                ],
              ],
            ]);
          });
        });
        describe("keyed selectors", () => {
          specify("single", () => {
            const tokens = tokenizer.tokenize("$name(key)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { LIST: [[[{ LITERAL: "key" }]]] },
                ],
              ],
            ]);
          });
          specify("multiple", () => {
            const tokens = tokenizer.tokenize("$name(key1 key2)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { LIST: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const tokens = tokenizer.tokenize("$name(key1)(key2 key3)(key4)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
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
            "$name(key1 key2){selector1}(key3){selector2 selector3}"
          );
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                { SUBSTITUTE_NEXT: 1 },
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
          const tokens = tokenizer.tokenize("$name1(key1 $name2{selector1})");
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                { SUBSTITUTE_NEXT: 1 },
                { LITERAL: "name1" },
                {
                  LIST: [
                    [
                      [{ LITERAL: "key1" }],
                      [
                        { SUBSTITUTE_NEXT: 1 },
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
    describe("compound words", () => {
      describe("variable names", () => {
        describe("generic selectors", () => {
          specify("single", () => {
            const tokens = tokenizer.tokenize("name{selector}");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [[{ LITERAL: "name" }, { BLOCK: [[[{ LITERAL: "selector" }]]] }]],
            ]);
          });
          specify("multiple", () => {
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
          });
          specify("chained", () => {
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
                      [[{ LITERAL: "selector2" }], [{ LITERAL: "selector3" }]],
                    ],
                  },
                  { BLOCK: [[[{ LITERAL: "selector4" }]]] },
                ],
              ],
            ]);
          });
        });
        describe("keyed selectors", () => {
          specify("single", () => {
            const tokens = tokenizer.tokenize("name(key)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [[{ LITERAL: "name" }, { LIST: [[[{ LITERAL: "key" }]]] }]],
            ]);
          });
          specify("multiple", () => {
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
          specify("chained", () => {
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
