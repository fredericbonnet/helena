import { expect } from "chai";
import { Parser } from "./parser";
import {
  Script,
  MorphemeType,
  Morpheme,
  LiteralMorpheme,
  TupleMorpheme,
  BlockMorpheme,
  ExpressionMorpheme,
  StringMorpheme,
  HereStringMorpheme,
  TaggedStringMorpheme,
  LineCommentMorpheme,
  BlockCommentMorpheme,
  SubstituteNextMorpheme,
} from "./syntax";
import { Tokenizer } from "./tokenizer";

const mapMorpheme = (morpheme: Morpheme) => {
  if (morpheme.type == MorphemeType.LITERAL) {
    return { LITERAL: (morpheme as LiteralMorpheme).value };
  }
  if (morpheme.type == MorphemeType.TUPLE) {
    return { TUPLE: toTree((morpheme as TupleMorpheme).subscript) };
  }
  if (morpheme.type == MorphemeType.BLOCK) {
    return { BLOCK: toTree((morpheme as BlockMorpheme).subscript) };
  }
  if (morpheme.type == MorphemeType.EXPRESSION) {
    return { EXPRESSION: toTree((morpheme as ExpressionMorpheme).subscript) };
  }
  if (morpheme.type == MorphemeType.STRING) {
    return { STRING: (morpheme as StringMorpheme).morphemes.map(mapMorpheme) };
  }
  if (morpheme.type == MorphemeType.HERE_STRING) {
    return { HERE_STRING: (morpheme as HereStringMorpheme).value };
  }
  if (morpheme.type == MorphemeType.TAGGED_STRING) {
    return { TAGGED_STRING: (morpheme as TaggedStringMorpheme).value };
  }
  if (morpheme.type == MorphemeType.LINE_COMMENT) {
    return { LINE_COMMENT: (morpheme as LineCommentMorpheme).value };
  }
  if (morpheme.type == MorphemeType.BLOCK_COMMENT) {
    return { BLOCK_COMMENT: (morpheme as BlockCommentMorpheme).value };
  }
  if (morpheme.type == MorphemeType.SUBSTITUTE_NEXT) {
    return {
      [(morpheme as SubstituteNextMorpheme).expansion
        ? "EXPAND_NEXT"
        : "SUBSTITUTE_NEXT"]: (morpheme as SubstituteNextMorpheme).levels,
    };
  }
  throw new Error("TODO");
};
const toTree = (script: Script) =>
  script.sentences.map((sentence) =>
    sentence.words.map((word) => word.morphemes.map(mapMorpheme))
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
    specify("blank sentences are ignored", () => {
      const tokens = tokenizer.tokenize(
        "\nsentence1;; \t  ;\n\n \t   \nsentence2\n"
      );
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
    describe("tuples", () => {
      specify("empty tuple", () => {
        const tokens = tokenizer.tokenize("()");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ TUPLE: [] }]]]);
      });
      specify("tuple with one word", () => {
        const tokens = tokenizer.tokenize("(word)");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ TUPLE: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("tuple with two levels", () => {
        const tokens = tokenizer.tokenize("(word1 (subword1 subword2) word2)");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                TUPLE: [
                  [
                    [{ LITERAL: "word1" }],
                    [
                      {
                        TUPLE: [
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
        specify("unterminated tuple", () => {
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
      describe("string value", () => {
        const getBlock = (script: Script, wordIndex: number) =>
          script.sentences[0].words[wordIndex].morphemes[0] as BlockMorpheme;
        specify("empty", () => {
          const tokens = tokenizer.tokenize("{}");
          const script = parser.parse(tokens);
          const block = getBlock(script, 0);
          expect(block.value).to.eql("");
        });
        specify("one word", () => {
          const tokens = tokenizer.tokenize("{word}");
          const script = parser.parse(tokens);
          const block = getBlock(script, 0);
          expect(block.value).to.eql("word");
        });
        specify("two levels", () => {
          const tokens = tokenizer.tokenize("{word1 {word2 word3} word4}");
          const script = parser.parse(tokens);
          const block = getBlock(script, 0);
          expect(block.value).to.eql("word1 {word2 word3} word4");
          const subblock = getBlock(block.subscript, 1);
          expect(subblock.value).to.eql("word2 word3");
        });
        specify("space preservation", () => {
          const tokens = tokenizer.tokenize("{ word1  \nword2\t}");
          const script = parser.parse(tokens);
          const block = getBlock(script, 0);
          expect(block.value).to.eql(" word1  \nword2\t");
        });
        specify("continuations", () => {
          const tokens = tokenizer.tokenize("{word1 \\\n \t  word2}");
          const script = parser.parse(tokens);
          const block = getBlock(script, 0);
          expect(block.value).to.eql("word1  word2");
        });
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
    describe("expressions", () => {
      specify("empty expression", () => {
        const tokens = tokenizer.tokenize("[]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([[[{ EXPRESSION: [] }]]]);
      });
      specify("expression with one word", () => {
        const tokens = tokenizer.tokenize("[word]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ EXPRESSION: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("expression with two levels", () => {
        const tokens = tokenizer.tokenize("[word1 [subword1 subword2] word2]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [
              {
                EXPRESSION: [
                  [
                    [{ LITERAL: "word1" }],
                    [
                      {
                        EXPRESSION: [
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
        specify("unterminated expression", () => {
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
      describe("expressions", () => {
        specify("empty expression", () => {
          const tokens = tokenizer.tokenize('"[]"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([[[{ STRING: [{ EXPRESSION: [] }] }]]]);
        });
        specify("expression with one word", () => {
          const tokens = tokenizer.tokenize('"[word]"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ EXPRESSION: [[[{ LITERAL: "word" }]]] }] }]],
          ]);
        });
        specify("expression with two levels", () => {
          const tokens = tokenizer.tokenize(
            '"[word1 [subword1 subword2] word2]"'
          );
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    {
                      EXPRESSION: [
                        [
                          [{ LITERAL: "word1" }],
                          [
                            {
                              EXPRESSION: [
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
                },
              ],
            ],
          ]);
        });
        describe("exceptions", () => {
          specify("unterminated expression", () => {
            const tokens = tokenizer.tokenize('"[');
            expect(() => parser.parse(tokens)).to.throws(
              "unmatched left bracket"
            );
          });
          specify("mismatched right parenthesis", () => {
            const tokens = tokenizer.tokenize('"[)"');
            expect(() => parser.parse(tokens)).to.throws(
              "mismatched right parenthesis"
            );
          });
          specify("mismatched right brace", () => {
            const tokens = tokenizer.tokenize('"[}"');
            expect(() => parser.parse(tokens)).to.throws(
              "mismatched right brace"
            );
          });
        });
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
        specify("tuple", () => {
          const tokens = tokenizer.tokenize('"$(a)"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: 1 },
                    { TUPLE: [[[{ LITERAL: "a" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("block", () => {
          const tokens = tokenizer.tokenize('"${a}"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: 1 },
                    { BLOCK: [[[{ LITERAL: "a" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("expression", () => {
          const tokens = tokenizer.tokenize('"$[a]"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: 1 },
                    { EXPRESSION: [[[{ LITERAL: "a" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("multiple substitution", () => {
          const tokens = tokenizer.tokenize('"$$a $$$b $$$$[c]"');
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
                    { LITERAL: " " },
                    { SUBSTITUTE_NEXT: 4 },
                    { EXPRESSION: [[[{ LITERAL: "c" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("expansion", () => {
          const tokens = tokenizer.tokenize('"$*$$*a $*$[b]"');
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { EXPAND_NEXT: 3 },
                    { LITERAL: "a" },
                    { LITERAL: " " },
                    { EXPAND_NEXT: 2 },
                    { EXPRESSION: [[[{ LITERAL: "b" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        describe("variable name delimiters", () => {
          specify("trailing dollars", () => {
            const tokens = tokenizer.tokenize('"a$ b$*$ c$$*$"');
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [[{ STRING: [{ LITERAL: "a$ b$*$ c$$*$" }] }]],
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
              const tokens = tokenizer.tokenize(
                '"$name{selector1} $[expression]{selector2}"'
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
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        { BLOCK: [[[{ LITERAL: "selector2" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("multiple", () => {
              const tokens = tokenizer.tokenize(
                '"$name{selector1 selector2} $[expression]{selector3 selector4}"'
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
                          BLOCK: [
                            [
                              [{ LITERAL: "selector1" }],
                              [{ LITERAL: "selector2" }],
                            ],
                          ],
                        },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          BLOCK: [
                            [
                              [{ LITERAL: "selector3" }],
                              [{ LITERAL: "selector4" }],
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
                '"$name{selector1}{selector2 selector3}{selector4} $[expression]{selector5 selector6}{selector7}{selector8 selector9}"'
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
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          BLOCK: [
                            [
                              [{ LITERAL: "selector5" }],
                              [{ LITERAL: "selector6" }],
                            ],
                          ],
                        },
                        { BLOCK: [[[{ LITERAL: "selector7" }]]] },
                        {
                          BLOCK: [
                            [
                              [{ LITERAL: "selector8" }],
                              [{ LITERAL: "selector9" }],
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
          describe("keyed selectors", () => {
            specify("single", () => {
              const tokens = tokenizer.tokenize(
                '"$name(key1) $[expression](key2)"'
              );
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        { TUPLE: [[[{ LITERAL: "key1" }]]] },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        { TUPLE: [[[{ LITERAL: "key2" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("multiple", () => {
              const tokens = tokenizer.tokenize(
                '"$name(key1 key2) $[expression](key3 key4)"'
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
                          TUPLE: [
                            [[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]],
                          ],
                        },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          TUPLE: [
                            [[{ LITERAL: "key3" }], [{ LITERAL: "key4" }]],
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
                '"$name(key1)(key2 key3)(key4) $[expression](key5 key6)(key7)(key8 key9)"'
              );
              const script = parser.parse(tokens);
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name" },
                        { TUPLE: [[[{ LITERAL: "key1" }]]] },
                        {
                          TUPLE: [
                            [[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]],
                          ],
                        },
                        { TUPLE: [[[{ LITERAL: "key4" }]]] },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          TUPLE: [
                            [[{ LITERAL: "key5" }], [{ LITERAL: "key6" }]],
                          ],
                        },
                        { TUPLE: [[[{ LITERAL: "key7" }]]] },
                        {
                          TUPLE: [
                            [[{ LITERAL: "key8" }], [{ LITERAL: "key9" }]],
                          ],
                        },
                      ],
                    },
                  ],
                ],
              ]);
            });
          });
          specify("mixed selectors", () => {
            const tokens = tokenizer.tokenize(
              '"$name(key1 key2){selector1}(key3){selector2 selector3} $[expression]{selector4 selector5}(key4 key5){selector6}(key6)"'
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
                        TUPLE: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]],
                      },
                      { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                      { TUPLE: [[[{ LITERAL: "key3" }]]] },
                      {
                        BLOCK: [
                          [
                            [{ LITERAL: "selector2" }],
                            [{ LITERAL: "selector3" }],
                          ],
                        ],
                      },
                      { LITERAL: " " },
                      { SUBSTITUTE_NEXT: 1 },
                      { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                      {
                        BLOCK: [
                          [
                            [{ LITERAL: "selector4" }],
                            [{ LITERAL: "selector5" }],
                          ],
                        ],
                      },
                      {
                        TUPLE: [[[{ LITERAL: "key4" }], [{ LITERAL: "key5" }]]],
                      },
                      { BLOCK: [[[{ LITERAL: "selector6" }]]] },
                      { TUPLE: [[[{ LITERAL: "key6" }]]] },
                    ],
                  },
                ],
              ],
            ]);
          });
          specify("nested selectors", () => {
            const tokens = tokenizer.tokenize(
              '"$name1(key1 $name2{selector1} $[expression1](key2)) $[expression2]{selector2 $name3(key3)}"'
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
                        TUPLE: [
                          [
                            [{ LITERAL: "key1" }],
                            [
                              { SUBSTITUTE_NEXT: 1 },
                              { LITERAL: "name2" },
                              { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                            ],
                            [
                              { SUBSTITUTE_NEXT: 1 },
                              { EXPRESSION: [[[{ LITERAL: "expression1" }]]] },
                              { TUPLE: [[[{ LITERAL: "key2" }]]] },
                            ],
                          ],
                        ],
                      },
                      { LITERAL: " " },
                      { SUBSTITUTE_NEXT: 1 },
                      { EXPRESSION: [[[{ LITERAL: "expression2" }]]] },
                      {
                        BLOCK: [
                          [
                            [{ LITERAL: "selector2" }],
                            [
                              { SUBSTITUTE_NEXT: 1 },
                              { LITERAL: "name3" },
                              { TUPLE: [[[{ LITERAL: "key3" }]]] },
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
      specify("tuple", () => {
        const tokens = tokenizer.tokenize("$(a)");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: 1 }, { TUPLE: [[[{ LITERAL: "a" }]]] }]],
        ]);
      });
      specify("block", () => {
        const tokens = tokenizer.tokenize("${a}");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: 1 }, { BLOCK: [[[{ LITERAL: "a" }]]] }]],
        ]);
      });
      specify("expression", () => {
        const tokens = tokenizer.tokenize("$[a]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: 1 }, { EXPRESSION: [[[{ LITERAL: "a" }]]] }]],
        ]);
      });
      specify("multiple substitution", () => {
        const tokens = tokenizer.tokenize("$$a $$$b $$$$[c]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [{ SUBSTITUTE_NEXT: 2 }, { LITERAL: "a" }],
            [{ SUBSTITUTE_NEXT: 3 }, { LITERAL: "b" }],
            [{ SUBSTITUTE_NEXT: 4 }, { EXPRESSION: [[[{ LITERAL: "c" }]]] }],
          ],
        ]);
      });
      specify("expansion", () => {
        const tokens = tokenizer.tokenize("$*$$*a $*$[b]");
        const script = parser.parse(tokens);
        expect(toTree(script)).to.eql([
          [
            [{ EXPAND_NEXT: 3 }, { LITERAL: "a" }],
            [{ EXPAND_NEXT: 2 }, { EXPRESSION: [[[{ LITERAL: "b" }]]] }],
          ],
        ]);
      });
      describe("variable name delimiters", () => {
        specify("trailing dollars", () => {
          const tokens = tokenizer.tokenize("a$ b$*$ c$$*$");
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [{ LITERAL: "a$" }],
              [{ LITERAL: "b$*$" }],
              [{ LITERAL: "c$$*$" }],
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
        describe("exceptions", () => {
          specify("leading hash", () => {
            const tokens = tokenizer.tokenize("$#");
            expect(() => parser.parse(tokens)).to.throws(
              "unexpected comment delimiter"
            );
          });
          specify("leading quote", () => {
            const tokens = tokenizer.tokenize('$"');
            expect(() => parser.parse(tokens)).to.throws(
              "unexpected string delimiter"
            );
          });
        });
      });
      describe("selectors", () => {
        describe("generic selectors", () => {
          specify("single", () => {
            const tokens = tokenizer.tokenize(
              "$name{selector1} $[expression]{selector2}"
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { BLOCK: [[[{ LITERAL: "selector2" }]]] },
                ],
              ],
            ]);
          });
          specify("multiple", () => {
            const tokens = tokenizer.tokenize(
              "$name{selector1 selector2} $[expression]{selector3 selector4}"
            );
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
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector3" }], [{ LITERAL: "selector4" }]],
                    ],
                  },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const tokens = tokenizer.tokenize(
              "$name{selector1}{selector2 selector3}{selector4} $[expression]{selector5 selector6}{selector7}{selector8 selector9}"
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
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector5" }], [{ LITERAL: "selector6" }]],
                    ],
                  },
                  { BLOCK: [[[{ LITERAL: "selector7" }]]] },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector8" }], [{ LITERAL: "selector9" }]],
                    ],
                  },
                ],
              ],
            ]);
          });
        });
        describe("keyed selectors", () => {
          specify("single", () => {
            const tokens = tokenizer.tokenize(
              "$name(key1) $[expression](key2)"
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { TUPLE: [[[{ LITERAL: "key2" }]]] },
                ],
              ],
            ]);
          });
          specify("multiple", () => {
            const tokens = tokenizer.tokenize(
              "$name(key1 key2) $[expression](key3 key4)"
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { TUPLE: [[[{ LITERAL: "key3" }], [{ LITERAL: "key4" }]]] },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const tokens = tokenizer.tokenize(
              "$name(key1)(key2 key3)(key4) $[expression](key5 key6)(key7)(key8 key9)"
            );
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }]]] },
                  { TUPLE: [[[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]]] },
                  { TUPLE: [[[{ LITERAL: "key4" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: 1 },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { TUPLE: [[[{ LITERAL: "key5" }], [{ LITERAL: "key6" }]]] },
                  { TUPLE: [[[{ LITERAL: "key7" }]]] },
                  { TUPLE: [[[{ LITERAL: "key8" }], [{ LITERAL: "key9" }]]] },
                ],
              ],
            ]);
          });
        });
        specify("mixed selectors", () => {
          const tokens = tokenizer.tokenize(
            "$name(key1 key2){selector1}(key3){selector2 selector3} $[expression]{selector4 selector5}(key4 key5){selector6}(key6)"
          );
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                { SUBSTITUTE_NEXT: 1 },
                { LITERAL: "name" },
                { TUPLE: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                { TUPLE: [[[{ LITERAL: "key3" }]]] },
                {
                  BLOCK: [
                    [[{ LITERAL: "selector2" }], [{ LITERAL: "selector3" }]],
                  ],
                },
              ],
              [
                { SUBSTITUTE_NEXT: 1 },
                { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                {
                  BLOCK: [
                    [[{ LITERAL: "selector4" }], [{ LITERAL: "selector5" }]],
                  ],
                },
                { TUPLE: [[[{ LITERAL: "key4" }], [{ LITERAL: "key5" }]]] },
                { BLOCK: [[[{ LITERAL: "selector6" }]]] },
                { TUPLE: [[[{ LITERAL: "key6" }]]] },
              ],
            ],
          ]);
        });
        specify("nested selectors", () => {
          const tokens = tokenizer.tokenize(
            "$name1(key1 $name2{selector1} $[expression1](key2)) $[expression2]{selector2 $name3(key3)}"
          );
          const script = parser.parse(tokens);
          expect(toTree(script)).to.eql([
            [
              [
                { SUBSTITUTE_NEXT: 1 },
                { LITERAL: "name1" },
                {
                  TUPLE: [
                    [
                      [{ LITERAL: "key1" }],
                      [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name2" },
                        { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                      ],
                      [
                        { SUBSTITUTE_NEXT: 1 },
                        { EXPRESSION: [[[{ LITERAL: "expression1" }]]] },
                        { TUPLE: [[[{ LITERAL: "key2" }]]] },
                      ],
                    ],
                  ],
                },
              ],
              [
                { SUBSTITUTE_NEXT: 1 },
                { EXPRESSION: [[[{ LITERAL: "expression2" }]]] },
                {
                  BLOCK: [
                    [
                      [{ LITERAL: "selector2" }],
                      [
                        { SUBSTITUTE_NEXT: 1 },
                        { LITERAL: "name3" },
                        { TUPLE: [[[{ LITERAL: "key3" }]]] },
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
              [[{ LITERAL: "name" }, { TUPLE: [[[{ LITERAL: "key" }]]] }]],
            ]);
          });
          specify("multiple", () => {
            const tokens = tokenizer.tokenize("name(key1 key2)");
            const script = parser.parse(tokens);
            expect(toTree(script)).to.eql([
              [
                [
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
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
                  { TUPLE: [[[{ LITERAL: "key1" }]]] },
                  { TUPLE: [[[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]]] },
                  { TUPLE: [[[{ LITERAL: "key4" }]]] },
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
                { TUPLE: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                { TUPLE: [[[{ LITERAL: "key3" }]]] },
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
                  TUPLE: [
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
