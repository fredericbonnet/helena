import { expect } from "chai";
import { Parser, PARSE_ERROR } from "./parser";
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
  Word,
  Sentence,
} from "./syntax";
import { ArrayTokenStream, StringStream, Tokenizer } from "./tokenizer";
import { Source } from "./source";

const mapMorphemeRaw = (morpheme: Morpheme) => {
  switch (morpheme.type) {
    case MorphemeType.LITERAL:
      return { LITERAL: (morpheme as LiteralMorpheme).value };

    case MorphemeType.TUPLE:
      return { TUPLE: toTree((morpheme as TupleMorpheme).subscript) };

    case MorphemeType.BLOCK:
      return { BLOCK: toTree((morpheme as BlockMorpheme).subscript) };

    case MorphemeType.EXPRESSION:
      return { EXPRESSION: toTree((morpheme as ExpressionMorpheme).subscript) };

    case MorphemeType.STRING:
      return {
        STRING: (morpheme as StringMorpheme).morphemes.map(mapMorpheme),
      };

    case MorphemeType.HERE_STRING:
      return { HERE_STRING: (morpheme as HereStringMorpheme).value };

    case MorphemeType.TAGGED_STRING:
      return { TAGGED_STRING: (morpheme as TaggedStringMorpheme).value };

    case MorphemeType.LINE_COMMENT:
      return { LINE_COMMENT: (morpheme as LineCommentMorpheme).value };

    case MorphemeType.BLOCK_COMMENT:
      return { BLOCK_COMMENT: (morpheme as BlockCommentMorpheme).value };

    case MorphemeType.SUBSTITUTE_NEXT:
      return {
        [(morpheme as SubstituteNextMorpheme).expansion
          ? "EXPAND_NEXT"
          : "SUBSTITUTE_NEXT"]: (morpheme as SubstituteNextMorpheme).value,
      };
    default:
      throw new Error("CANTHAPPEN");
  }
};
const mapMorpheme = (morpheme) => {
  if (morpheme.position) {
    return {
      ...mapMorphemeRaw(morpheme),
      position: morpheme.position,
    };
  } else {
    return mapMorphemeRaw(morpheme);
  }
};
const mapWord = (word: Word) => {
  if (word.position) {
    return {
      morphemes: word.morphemes.map(mapMorpheme),
      position: word.position,
    };
  } else {
    return word.morphemes.map(mapMorpheme);
  }
};
const mapSentence = (sentence: Sentence) => {
  if (sentence.position) {
    return {
      words: sentence.words.map((word) => mapWord(word as Word)),
      position: sentence.position,
    };
  } else {
    return sentence.words.map((word) => mapWord(word as Word));
  }
};
const toTree = (script: Script) => {
  if (script.position) {
    return {
      sentences: script.sentences.map(mapSentence),
      position: script.position,
    };
  } else {
    return script.sentences.map(mapSentence);
  }
};

describe("Parser", () => {
  let tokenizer: Tokenizer;
  let parser: Parser;
  const parse = (script: string) =>
    parser.parseTokens(tokenizer.tokenize(script)).script;

  beforeEach(() => {
    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("scripts", () => {
    specify("empty script", () => {
      const script = parse("");
      expect(script.sentences).to.be.empty;
    });
    specify("blank lines", () => {
      const script = parse(" \n\n    \n");
      expect(script.sentences).to.be.empty;
    });
    specify("single sentence", () => {
      const script = parse("sentence");
      expect(toTree(script)).to.eql([[[{ LITERAL: "sentence" }]]]);
    });
    specify("single sentence surrounded by blank lines", () => {
      const script = parse("  \nsentence\n  ");
      expect(toTree(script)).to.eql([[[{ LITERAL: "sentence" }]]]);
    });
    specify("two sentences separated by newline", () => {
      const script = parse("sentence1\nsentence2");
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "sentence1" }]],
        [[{ LITERAL: "sentence2" }]],
      ]);
    });
    specify("two sentences separated by semicolon", () => {
      const script = parse("sentence1;sentence2");
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "sentence1" }]],
        [[{ LITERAL: "sentence2" }]],
      ]);
    });
    specify("blank sentences are ignored", () => {
      const script = parse("\nsentence1;; \t  ;\n\n \t   \nsentence2\n");
      expect(toTree(script)).to.eql([
        [[{ LITERAL: "sentence1" }]],
        [[{ LITERAL: "sentence2" }]],
      ]);
    });
  });
  describe("words", () => {
    describe("literals", () => {
      specify("single literal", () => {
        const script = parse("word");
        expect(toTree(script)).to.eql([[[{ LITERAL: "word" }]]]);
      });
      specify("single literal surrounded by spaces", () => {
        const script = parse(" word ");
        expect(toTree(script)).to.eql([[[{ LITERAL: "word" }]]]);
      });
      specify("single literal with escape sequences", () => {
        const script = parse("one\\tword");
        expect(toTree(script)).to.eql([[[{ LITERAL: "one\tword" }]]]);
      });
      specify("two literals separated by whitespace", () => {
        const script = parse("word1 word2");
        expect(toTree(script)).to.eql([
          [[{ LITERAL: "word1" }], [{ LITERAL: "word2" }]],
        ]);
      });
      specify("two literals separated by continuation", () => {
        const script = parse("word1\\\nword2");
        expect(toTree(script)).to.eql([
          [[{ LITERAL: "word1" }], [{ LITERAL: "word2" }]],
        ]);
      });
    });
    describe("tuples", () => {
      specify("empty tuple", () => {
        const script = parse("()");
        expect(toTree(script)).to.eql([[[{ TUPLE: [] }]]]);
      });
      specify("tuple with one word", () => {
        const script = parse("(word)");
        expect(toTree(script)).to.eql([
          [[{ TUPLE: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("tuple with two levels", () => {
        const script = parse("(word1 (subword1 subword2) word2)");
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
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched left parenthesis")
          );
        });
        specify("unmatched right parenthesis", () => {
          const tokens = tokenizer.tokenize(")");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched right parenthesis")
          );
        });
        specify("mismatched right brace", () => {
          const tokens = tokenizer.tokenize("(}");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("mismatched right brace")
          );
        });
        specify("mismatched right bracket", () => {
          const tokens = tokenizer.tokenize("(]");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("mismatched right bracket")
          );
        });
      });
    });
    describe("blocks", () => {
      specify("empty block", () => {
        const script = parse("{}");
        expect(toTree(script)).to.eql([[[{ BLOCK: [] }]]]);
      });
      specify("block with one word", () => {
        const script = parse("{word}");
        expect(toTree(script)).to.eql([
          [[{ BLOCK: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("block with two levels", () => {
        const script = parse("{word1 {subword1 subword2} word2}");
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
          (script.sentences[0].words[wordIndex] as Word)
            .morphemes[0] as BlockMorpheme;
        specify("empty", () => {
          const script = parse("{}");
          const block = getBlock(script, 0);
          expect(block.value).to.eql("");
        });
        specify("one word", () => {
          const script = parse("{word}");
          const block = getBlock(script, 0);
          expect(block.value).to.eql("word");
        });
        specify("two levels", () => {
          const script = parse("{word1 {word2 word3} word4}");
          const block = getBlock(script, 0);
          expect(block.value).to.eql("word1 {word2 word3} word4");
          const subblock = getBlock(block.subscript, 1);
          expect(subblock.value).to.eql("word2 word3");
        });
        specify("space preservation", () => {
          const script = parse("{ word1  \nword2\t}");
          const block = getBlock(script, 0);
          expect(block.value).to.eql(" word1  \nword2\t");
        });
        specify("continuations", () => {
          const script = parse("{word1 \\\n \t  word2}");
          const block = getBlock(script, 0);
          expect(block.value).to.eql("word1  word2");
        });
      });
      describe("exceptions", () => {
        specify("unterminated block", () => {
          const tokens = tokenizer.tokenize("{");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched left brace")
          );
        });
        specify("unmatched right brace", () => {
          const tokens = tokenizer.tokenize("}");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched right brace")
          );
        });
        specify("mismatched right parenthesis", () => {
          const tokens = tokenizer.tokenize("{)");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("mismatched right parenthesis")
          );
        });
        specify("mismatched right bracket", () => {
          const tokens = tokenizer.tokenize("{]");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("mismatched right bracket")
          );
        });
      });
    });
    describe("expressions", () => {
      specify("empty expression", () => {
        const script = parse("[]");
        expect(toTree(script)).to.eql([[[{ EXPRESSION: [] }]]]);
      });
      specify("expression with one word", () => {
        const script = parse("[word]");
        expect(toTree(script)).to.eql([
          [[{ EXPRESSION: [[[{ LITERAL: "word" }]]] }]],
        ]);
      });
      specify("expression with two levels", () => {
        const script = parse("[word1 [subword1 subword2] word2]");
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
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched left bracket")
          );
        });
        specify("unmatched right bracket", () => {
          const tokens = tokenizer.tokenize("]");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched right bracket")
          );
        });
        specify("mismatched right parenthesis", () => {
          const tokens = tokenizer.tokenize("[)");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("mismatched right parenthesis")
          );
        });
        specify("mismatched right brace", () => {
          const tokens = tokenizer.tokenize("[}");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("mismatched right brace")
          );
        });
      });
    });
    describe("strings", () => {
      specify("empty string", () => {
        const script = parse('""');
        expect(toTree(script)).to.eql([[[{ STRING: [] }]]]);
      });
      specify("simple string", () => {
        const script = parse('"string"');
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "string" }] }]],
        ]);
      });
      specify("longer string", () => {
        const script = parse('"this is a string"');
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "this is a string" }] }]],
        ]);
      });
      specify("string with whitespaces and continuations", () => {
        const script = parse('"this  \t  is\r\f a   \\\n  \t  string"');
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "this  \t  is\r\f a    string" }] }]],
        ]);
      });
      specify("string with special characters", () => {
        const script = parse('"this {is (a #string"');
        expect(toTree(script)).to.eql([
          [[{ STRING: [{ LITERAL: "this {is (a #string" }] }]],
        ]);
        expect(toTree(parse('"("'))).to.eql([
          [[{ STRING: [{ LITERAL: "(" }] }]],
        ]);
        expect(toTree(parse('"{"'))).to.eql([
          [[{ STRING: [{ LITERAL: "{" }] }]],
        ]);
      });
      describe("expressions", () => {
        specify("empty expression", () => {
          const script = parse('"[]"');
          expect(toTree(script)).to.eql([[[{ STRING: [{ EXPRESSION: [] }] }]]]);
        });
        specify("expression with one word", () => {
          const script = parse('"[word]"');
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ EXPRESSION: [[[{ LITERAL: "word" }]]] }] }]],
          ]);
        });
        specify("expression with two levels", () => {
          const script = parse('"[word1 [subword1 subword2] word2]"');
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
            expect(parser.parseTokens(tokens)).to.eql(
              PARSE_ERROR("unmatched left bracket")
            );
          });
          specify("mismatched right parenthesis", () => {
            const tokens = tokenizer.tokenize('"[)"');
            expect(parser.parseTokens(tokens)).to.eql(
              PARSE_ERROR("mismatched right parenthesis")
            );
          });
          specify("mismatched right brace", () => {
            const tokens = tokenizer.tokenize('"[}"');
            expect(parser.parseTokens(tokens)).to.eql(
              PARSE_ERROR("mismatched right brace")
            );
          });
        });
      });
      describe("substitutions", () => {
        specify("lone dollar", () => {
          const script = parse('"$"');
          expect(toTree(script)).to.eql([[[{ STRING: [{ LITERAL: "$" }] }]]]);
        });
        specify("simple variable", () => {
          const script = parse('"$a"');
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a" }] }]],
          ]);
        });
        specify("Unicode variable name", () => {
          const script = parse('"$a\u1234"');
          expect(toTree(script)).to.eql([
            [[{ STRING: [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a\u1234" }] }]],
          ]);
        });
        specify("block", () => {
          const script = parse('"${a}"');
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: "$" },
                    { BLOCK: [[[{ LITERAL: "a" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("expression", () => {
          const script = parse('"$[a]"');
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: "$" },
                    { EXPRESSION: [[[{ LITERAL: "a" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("multiple substitution", () => {
          const script = parse('"$$a $$$b $$$$[c]"');
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$" },
                    { LITERAL: "a" },
                    { LITERAL: " " },
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$" },
                    { LITERAL: "b" },
                    { LITERAL: " " },
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$" },
                    { EXPRESSION: [[[{ LITERAL: "c" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        specify("expansion", () => {
          const script = parse('"$*$$*a $*$[b]"');
          expect(toTree(script)).to.eql([
            [
              [
                {
                  STRING: [
                    { EXPAND_NEXT: "$*" },
                    { SUBSTITUTE_NEXT: "$" },
                    { SUBSTITUTE_NEXT: "$*" },
                    { LITERAL: "a" },
                    { LITERAL: " " },
                    { EXPAND_NEXT: "$*" },
                    { SUBSTITUTE_NEXT: "$" },
                    { EXPRESSION: [[[{ LITERAL: "b" }]]] },
                  ],
                },
              ],
            ],
          ]);
        });
        describe("variable name delimiters", () => {
          specify("trailing dollars", () => {
            const script = parse('"a$ b$*$ c$$*$"');
            expect(toTree(script)).to.eql([
              [[{ STRING: [{ LITERAL: "a$ b$*$ c$$*$" }] }]],
            ]);
          });
          specify("escapes", () => {
            const script = parse('"$a\\x62 $c\\d"');
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [
                      { SUBSTITUTE_NEXT: "$" },
                      { LITERAL: "a" },
                      { LITERAL: "b " },
                      { SUBSTITUTE_NEXT: "$" },
                      { LITERAL: "c" },
                      { LITERAL: "d" },
                    ],
                  },
                ],
              ],
            ]);
          });
          specify("parentheses", () => {
            const script = parse('"$(a"');
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [{ LITERAL: "$(a" }],
                  },
                ],
              ],
            ]);
          });
          specify("special characters", () => {
            const script = parse("$a# $b*");
            expect(toTree(script)).to.eql([
              [
                [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a" }, { LITERAL: "#" }],
                [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "b" }, { LITERAL: "*" }],
              ],
            ]);
          });
        });
        describe("selectors", () => {
          describe("indexed selectors", () => {
            specify("single", () => {
              const script = parse('"$name[index1] $[expression][index2]"');
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        { EXPRESSION: [[[{ LITERAL: "index1" }]]] },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        { EXPRESSION: [[[{ LITERAL: "index2" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("chained", () => {
              const script = parse(
                '"$name[index1][index2][index3] $[expression][index4][index5][index6]"'
              );
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        { EXPRESSION: [[[{ LITERAL: "index1" }]]] },
                        {
                          EXPRESSION: [[[{ LITERAL: "index2" }]]],
                        },
                        { EXPRESSION: [[[{ LITERAL: "index3" }]]] },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          EXPRESSION: [[[{ LITERAL: "index4" }]]],
                        },
                        { EXPRESSION: [[[{ LITERAL: "index5" }]]] },
                        {
                          EXPRESSION: [[[{ LITERAL: "index6" }]]],
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
              const script = parse('"$name(key1) $[expression](key2)"');
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        { TUPLE: [[[{ LITERAL: "key1" }]]] },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        { TUPLE: [[[{ LITERAL: "key2" }]]] },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("multiple", () => {
              const script = parse(
                '"$name(key1 key2) $[expression](key3 key4)"'
              );
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        {
                          TUPLE: [
                            [[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]],
                          ],
                        },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
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
              const script = parse(
                '"$name(key1)(key2 key3)(key4) $[expression](key5 key6)(key7)(key8 key9)"'
              );
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        { TUPLE: [[[{ LITERAL: "key1" }]]] },
                        {
                          TUPLE: [
                            [[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]],
                          ],
                        },
                        { TUPLE: [[[{ LITERAL: "key4" }]]] },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
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
          describe("generic selectors", () => {
            specify("single", () => {
              const script = parse(
                '"$name{selector1 arg1} $[expression]{selector2 arg2}"'
              );
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        {
                          BLOCK: [
                            [[{ LITERAL: "selector1" }], [{ LITERAL: "arg1" }]],
                          ],
                        },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          BLOCK: [
                            [[{ LITERAL: "selector2" }], [{ LITERAL: "arg2" }]],
                          ],
                        },
                      ],
                    },
                  ],
                ],
              ]);
            });
            specify("chained", () => {
              const script = parse(
                '"$name{selector1 arg1}{selector2}{selector3 arg2 arg3} $[expression]{selector4}{selector5 arg4 arg5}{selector6 arg6}"'
              );
              expect(toTree(script)).to.eql([
                [
                  [
                    {
                      STRING: [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name" },
                        {
                          BLOCK: [
                            [[{ LITERAL: "selector1" }], [{ LITERAL: "arg1" }]],
                          ],
                        },
                        {
                          BLOCK: [[[{ LITERAL: "selector2" }]]],
                        },
                        {
                          BLOCK: [
                            [
                              [{ LITERAL: "selector3" }],
                              [{ LITERAL: "arg2" }],
                              [{ LITERAL: "arg3" }],
                            ],
                          ],
                        },
                        { LITERAL: " " },
                        { SUBSTITUTE_NEXT: "$" },
                        { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                        {
                          BLOCK: [[[{ LITERAL: "selector4" }]]],
                        },
                        {
                          BLOCK: [
                            [
                              [{ LITERAL: "selector5" }],
                              [{ LITERAL: "arg4" }],
                              [{ LITERAL: "arg5" }],
                            ],
                          ],
                        },
                        {
                          BLOCK: [
                            [[{ LITERAL: "selector6" }], [{ LITERAL: "arg6" }]],
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
            const script = parse(
              '"$name(key1 key2){selector1}(key3){selector2 selector3} $[expression]{selector4 selector5}(key4 key5){selector6}(key6)"'
            );
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [
                      { SUBSTITUTE_NEXT: "$" },
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
                      { SUBSTITUTE_NEXT: "$" },
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
            const script = parse(
              '"$name1(key1 $name2{selector1} $[expression1](key2)) $[expression2]{selector2 $name3(key3)}"'
            );
            expect(toTree(script)).to.eql([
              [
                [
                  {
                    STRING: [
                      { SUBSTITUTE_NEXT: "$" },
                      { LITERAL: "name1" },
                      {
                        TUPLE: [
                          [
                            [{ LITERAL: "key1" }],
                            [
                              { SUBSTITUTE_NEXT: "$" },
                              { LITERAL: "name2" },
                              { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                            ],
                            [
                              { SUBSTITUTE_NEXT: "$" },
                              { EXPRESSION: [[[{ LITERAL: "expression1" }]]] },
                              { TUPLE: [[[{ LITERAL: "key2" }]]] },
                            ],
                          ],
                        ],
                      },
                      { LITERAL: " " },
                      { SUBSTITUTE_NEXT: "$" },
                      { EXPRESSION: [[[{ LITERAL: "expression2" }]]] },
                      {
                        BLOCK: [
                          [
                            [{ LITERAL: "selector2" }],
                            [
                              { SUBSTITUTE_NEXT: "$" },
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
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched string delimiter")
          );
        });
        specify("extra quotes", () => {
          const tokens = tokenizer.tokenize('"hello""');
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("extra characters after string delimiter")
          );
        });
      });
    });
    describe("here-strings", () => {
      specify("3-quote delimiter", () => {
        const script = parse(
          '"""some " \\\n    $arbitrary [character\n  "" sequence"""'
        );
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
        const script = parse('""""here is """ some text""""');
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
        const script = parse(
          '""" <- 3 quotes here / 4 quotes there -> """" / 3 quotes here -> """'
        );
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
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched here-string delimiter")
          );
        });
        specify("extra quotes", () => {
          const tokens = tokenizer.tokenize(
            '""" <- 3 quotes here / 4 quotes there -> """"'
          );
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched here-string delimiter")
          );
        });
      });
    });
    describe("tagged strings", () => {
      specify("empty tagged string", () => {
        const script = parse('""EOF\nEOF""');
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: "" }]]]);
      });
      specify("single empty line", () => {
        const script = parse('""EOF\n\nEOF""');
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: "\n" }]]]);
      });
      specify("extra characters after open delimiter", () => {
        const script = parse(
          '""EOF some $arbitrary[ }text\\\n (with continuation\nfoo\nbar\nEOF""'
        );
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: "foo\nbar\n" }]]]);
      });
      specify("tag within string", () => {
        const script = parse('""EOF\nEOF ""\nEOF""');
        expect(toTree(script)).to.eql([[[{ TAGGED_STRING: 'EOF ""\n' }]]]);
      });
      specify("continuations", () => {
        const script = parse('""EOF\nsome\\\n   string\nEOF""');
        expect(toTree(script)).to.eql([
          [[{ TAGGED_STRING: "some\\\n   string\n" }]],
        ]);
      });
      specify("indentation", () => {
        const script = parse(`""EOF
          #include <stdio.h>
          
          int main(void) {
            printf("Hello, world!");
            return 0;
          }
          EOF""`);
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
        const script = parse(`""EOF
1  #include <stdio.h>
2  
3  int main(void) {
4    printf("Hello, world!");
5    return 0;
6  }
   EOF""`);
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
      specify("prefix with shorter lines", () => {
        const script = parse(`""TAG
          $ prompt

          > result
          > TAG""`);
        expect(toTree(script)).to.eql([
          [[{ TAGGED_STRING: `prompt\n\nresult\n` }]],
        ]);
      });
      describe("exceptions", () => {
        specify("unterminated tagged string", () => {
          const tokens = tokenizer.tokenize('""EOF\nhello');
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched tagged string delimiter")
          );
        });
        specify("extra quotes", () => {
          const tokens = tokenizer.tokenize('""EOF\nhello\nEOF"""');
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched tagged string delimiter")
          );
        });
      });
    });
    describe("line comments", () => {
      specify("empty line comment", () => {
        const script = parse("#");
        expect(toTree(script)).to.eql([[[{ LINE_COMMENT: "" }]]]);
      });
      specify("simple line comment", () => {
        const script = parse("# this is a comment");
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this is a comment" }]],
        ]);
      });
      specify("line comment with special characters", () => {
        const script = parse("# this ; is$ (a [comment{");
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this ; is$ (a [comment{" }]],
        ]);
      });
      specify("line comment with continuation", () => {
        const script = parse("# this is\\\na comment");
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this is a comment" }]],
        ]);
      });
      specify("line comment with escapes", () => {
        const script = parse("# hello \\x41\\t");
        expect(toTree(script)).to.eql([[[{ LINE_COMMENT: " hello A\t" }]]]);
      });
      specify("line comment with multiple hashes", () => {
        const script = parse("### this is a comment");
        expect(toTree(script)).to.eql([
          [[{ LINE_COMMENT: " this is a comment" }]],
        ]);
      });
    });
    describe("block comments", () => {
      specify("empty block comment", () => {
        const script = parse("#{}#");
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "" }]]]);
      });
      specify("simple block comment", () => {
        const script = parse("#{comment}#");
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "comment" }]]]);
      });
      specify("multiple line block comment", () => {
        const script = parse("#{\ncomment\n}#");
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "\ncomment\n" }]]]);
      });
      specify("block comment with continuation", () => {
        const script = parse("#{this is\\\na comment}#");
        expect(toTree(script)).to.eql([
          [[{ BLOCK_COMMENT: "this is\\\na comment" }]],
        ]);
      });
      specify("block comment with escapes", () => {
        const script = parse("#{hello \\x41\\t}#");
        expect(toTree(script)).to.eql([
          [[{ BLOCK_COMMENT: "hello \\x41\\t" }]],
        ]);
      });
      specify("block comment with multiple hashes", () => {
        const script = parse("##{comment}##");
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "comment" }]]]);
      });
      specify("nested block comments", () => {
        const script = parse("##{comment ##{}##}##");
        expect(toTree(script)).to.eql([
          [[{ BLOCK_COMMENT: "comment ##{}##" }]],
        ]);
      });
      specify("nested block comments with different prefixes", () => {
        const script = parse("##{comment #{}##");
        expect(toTree(script)).to.eql([[[{ BLOCK_COMMENT: "comment #{" }]]]);
      });
      describe("exceptions", () => {
        specify("unterminated block comment", () => {
          const tokens = tokenizer.tokenize("#{hello");
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched block comment delimiter")
          );
        });
        specify("extra hashes", () => {
          const tokens = tokenizer.tokenize(
            "#{ <- 1 hash here / 2 hashes there -> }##"
          );
          expect(parser.parseTokens(tokens)).to.eql(
            PARSE_ERROR("unmatched block comment delimiter")
          );
        });
      });
    });
    describe("substitutions", () => {
      specify("lone dollar", () => {
        const script = parse("$");
        expect(toTree(script)).to.eql([[[{ LITERAL: "$" }]]]);
      });
      specify("simple variable", () => {
        const script = parse("$a");
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a" }]],
        ]);
      });
      specify("Unicode variable name", () => {
        const script = parse("$a\u1234");
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a\u1234" }]],
        ]);
      });
      specify("tuple", () => {
        const script = parse("$(a)");
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: "$" }, { TUPLE: [[[{ LITERAL: "a" }]]] }]],
        ]);
      });
      specify("block", () => {
        const script = parse("${a}");
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: "$" }, { BLOCK: [[[{ LITERAL: "a" }]]] }]],
        ]);
      });
      specify("expression", () => {
        const script = parse("$[a]");
        expect(toTree(script)).to.eql([
          [[{ SUBSTITUTE_NEXT: "$" }, { EXPRESSION: [[[{ LITERAL: "a" }]]] }]],
        ]);
      });
      specify("multiple substitution", () => {
        const script = parse("$$a $$$b $$$$[c]");
        expect(toTree(script)).to.eql([
          [
            [
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$" },
              { LITERAL: "a" },
            ],
            [
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$" },
              { LITERAL: "b" },
            ],
            [
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$" },
              { EXPRESSION: [[[{ LITERAL: "c" }]]] },
            ],
          ],
        ]);
      });
      specify("expansion", () => {
        const script = parse("$*$$*a $*$[b]");
        expect(toTree(script)).to.eql([
          [
            [
              { EXPAND_NEXT: "$*" },
              { SUBSTITUTE_NEXT: "$" },
              { SUBSTITUTE_NEXT: "$*" },
              { LITERAL: "a" },
            ],
            [
              { EXPAND_NEXT: "$*" },
              { SUBSTITUTE_NEXT: "$" },
              { EXPRESSION: [[[{ LITERAL: "b" }]]] },
            ],
          ],
        ]);
      });
      describe("variable name delimiters", () => {
        specify("trailing dollars", () => {
          const script = parse("a$ b$*$ c$$*$");
          expect(toTree(script)).to.eql([
            [
              [{ LITERAL: "a$" }],
              [{ LITERAL: "b$*$" }],
              [{ LITERAL: "c$$*$" }],
            ],
          ]);
        });
        specify("escapes", () => {
          const script = parse("$a\\x62 $c\\d");
          expect(toTree(script)).to.eql([
            [
              [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a" }, { LITERAL: "b" }],
              [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "c" }, { LITERAL: "d" }],
            ],
          ]);
        });
        specify("special characters", () => {
          const script = parse("$a# $b*");
          expect(toTree(script)).to.eql([
            [
              [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "a" }, { LITERAL: "#" }],
              [{ SUBSTITUTE_NEXT: "$" }, { LITERAL: "b" }, { LITERAL: "*" }],
            ],
          ]);
        });
        describe("exceptions", () => {
          specify("leading hash", () => {
            const tokens = tokenizer.tokenize("$#");
            expect(parser.parseTokens(tokens)).to.eql(
              PARSE_ERROR("unexpected comment delimiter")
            );
          });
          specify("leading quote", () => {
            const tokens = tokenizer.tokenize('$"');
            expect(parser.parseTokens(tokens)).to.eql(
              PARSE_ERROR("unexpected string delimiter")
            );
          });
        });
      });
      describe("selectors", () => {
        describe("indexed selectors", () => {
          specify("single", () => {
            const script = parse("$name[index1] $[expression][index2]");
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { EXPRESSION: [[[{ LITERAL: "index1" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { EXPRESSION: [[[{ LITERAL: "index2" }]]] },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const script = parse(
              "$name[index1][index2][index3] $[expression][index4][index5][index6]"
            );
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { EXPRESSION: [[[{ LITERAL: "index1" }]]] },
                  { EXPRESSION: [[[{ LITERAL: "index2" }]]] },
                  { EXPRESSION: [[[{ LITERAL: "index3" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { EXPRESSION: [[[{ LITERAL: "index4" }]]] },
                  { EXPRESSION: [[[{ LITERAL: "index5" }]]] },
                  { EXPRESSION: [[[{ LITERAL: "index6" }]]] },
                ],
              ],
            ]);
          });
        });
        describe("keyed selectors", () => {
          specify("single", () => {
            const script = parse("$name(key1) $[expression](key2)");
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { TUPLE: [[[{ LITERAL: "key2" }]]] },
                ],
              ],
            ]);
          });
          specify("multiple", () => {
            const script = parse("$name(key1 key2) $[expression](key3 key4)");
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }], [{ LITERAL: "key2" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { TUPLE: [[[{ LITERAL: "key3" }], [{ LITERAL: "key4" }]]] },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const script = parse(
              "$name(key1)(key2 key3)(key4) $[expression](key5 key6)(key7)(key8 key9)"
            );
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { TUPLE: [[[{ LITERAL: "key1" }]]] },
                  { TUPLE: [[[{ LITERAL: "key2" }], [{ LITERAL: "key3" }]]] },
                  { TUPLE: [[[{ LITERAL: "key4" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { TUPLE: [[[{ LITERAL: "key5" }], [{ LITERAL: "key6" }]]] },
                  { TUPLE: [[[{ LITERAL: "key7" }]]] },
                  { TUPLE: [[[{ LITERAL: "key8" }], [{ LITERAL: "key9" }]]] },
                ],
              ],
            ]);
          });
        });
        describe("generic selectors", () => {
          specify("single", () => {
            const script = parse("$name{selector1} $[expression]{selector2}");
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  { BLOCK: [[[{ LITERAL: "selector2" }]]] },
                ],
              ],
            ]);
          });
          specify("chained", () => {
            const script = parse(
              "$name{selector1}{selector2 arg1}{selector3} $[expression]{selector4 arg2 arg3}{selector5}{selector6 arg4}"
            );
            expect(toTree(script)).to.eql([
              [
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { LITERAL: "name" },
                  { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector2" }], [{ LITERAL: "arg1" }]],
                    ],
                  },
                  { BLOCK: [[[{ LITERAL: "selector3" }]]] },
                ],
                [
                  { SUBSTITUTE_NEXT: "$" },
                  { EXPRESSION: [[[{ LITERAL: "expression" }]]] },
                  {
                    BLOCK: [
                      [
                        [{ LITERAL: "selector4" }],
                        [{ LITERAL: "arg2" }],
                        [{ LITERAL: "arg3" }],
                      ],
                    ],
                  },
                  { BLOCK: [[[{ LITERAL: "selector5" }]]] },
                  {
                    BLOCK: [
                      [[{ LITERAL: "selector6" }], [{ LITERAL: "arg4" }]],
                    ],
                  },
                ],
              ],
            ]);
          });
        });
        specify("mixed selectors", () => {
          const script = parse(
            "$name(key1 key2){selector1}(key3){selector2 selector3} $[expression]{selector4 selector5}(key4 key5){selector6}(key6)"
          );
          expect(toTree(script)).to.eql([
            [
              [
                { SUBSTITUTE_NEXT: "$" },
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
                { SUBSTITUTE_NEXT: "$" },
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
          const script = parse(
            "$name1(key1 $name2{selector1} $[expression1](key2)) $[expression2]{selector2 $name3(key3)}"
          );
          expect(toTree(script)).to.eql([
            [
              [
                { SUBSTITUTE_NEXT: "$" },
                { LITERAL: "name1" },
                {
                  TUPLE: [
                    [
                      [{ LITERAL: "key1" }],
                      [
                        { SUBSTITUTE_NEXT: "$" },
                        { LITERAL: "name2" },
                        { BLOCK: [[[{ LITERAL: "selector1" }]]] },
                      ],
                      [
                        { SUBSTITUTE_NEXT: "$" },
                        { EXPRESSION: [[[{ LITERAL: "expression1" }]]] },
                        { TUPLE: [[[{ LITERAL: "key2" }]]] },
                      ],
                    ],
                  ],
                },
              ],
              [
                { SUBSTITUTE_NEXT: "$" },
                { EXPRESSION: [[[{ LITERAL: "expression2" }]]] },
                {
                  BLOCK: [
                    [
                      [{ LITERAL: "selector2" }],
                      [
                        { SUBSTITUTE_NEXT: "$" },
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
    describe("qualified words", () => {
      describe("indexed selectors", () => {
        specify("single", () => {
          const script = parse("name[index]");
          expect(toTree(script)).to.eql([
            [[{ LITERAL: "name" }, { EXPRESSION: [[[{ LITERAL: "index" }]]] }]],
          ]);
        });
        specify("chained", () => {
          const script = parse("name[index1][index2][index3]");
          expect(toTree(script)).to.eql([
            [
              [
                { LITERAL: "name" },
                { EXPRESSION: [[[{ LITERAL: "index1" }]]] },
                { EXPRESSION: [[[{ LITERAL: "index2" }]]] },
                { EXPRESSION: [[[{ LITERAL: "index3" }]]] },
              ],
            ],
          ]);
        });
      });
      describe("keyed selectors", () => {
        specify("single", () => {
          const script = parse("name(key)");
          expect(toTree(script)).to.eql([
            [[{ LITERAL: "name" }, { TUPLE: [[[{ LITERAL: "key" }]]] }]],
          ]);
        });
        specify("multiple", () => {
          const script = parse("name(key1 key2)");
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
          const script = parse("name(key1)(key2 key3)(key4)");
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
      describe("generic selectors", () => {
        specify("single", () => {
          const script = parse("name{selector}");
          expect(toTree(script)).to.eql([
            [[{ LITERAL: "name" }, { BLOCK: [[[{ LITERAL: "selector" }]]] }]],
          ]);
        });
        specify("multiple", () => {
          const script = parse("name{selector1 selector2}");
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
          const script = parse(
            "name{selector1}{selector2 selector3}{selector4}"
          );
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
      specify("mixed selectors", () => {
        const script = parse(
          "name(key1 key2){selector1}(key3){selector2 selector3}"
        );
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
        const script = parse("name1(key1 name2{selector1})");
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

  describe("capturePositions", () => {
    beforeEach(() => {
      parser = new Parser({ capturePositions: true });
    });
    specify("literals", () => {
      const script = parse("this is a list\nof literals");
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    LITERAL: "this",
                  },
                ],
              },
              {
                position: { index: 5, line: 0, column: 5 },
                morphemes: [
                  {
                    position: { index: 5, line: 0, column: 5 },
                    LITERAL: "is",
                  },
                ],
              },
              {
                position: { index: 8, line: 0, column: 8 },
                morphemes: [
                  {
                    position: { index: 8, line: 0, column: 8 },
                    LITERAL: "a",
                  },
                ],
              },
              {
                position: { index: 10, line: 0, column: 10 },
                morphemes: [
                  {
                    position: { index: 10, line: 0, column: 10 },
                    LITERAL: "list",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 15, line: 1, column: 0 },
            words: [
              {
                position: { index: 15, line: 1, column: 0 },
                morphemes: [
                  {
                    position: { index: 15, line: 1, column: 0 },
                    LITERAL: "of",
                  },
                ],
              },
              {
                position: { index: 18, line: 1, column: 3 },
                morphemes: [
                  {
                    position: { index: 18, line: 1, column: 3 },
                    LITERAL: "literals",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("tuples", () => {
      const script = parse("( ; ) ( ( \n ) ())");
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    TUPLE: {
                      position: { index: 0, line: 0, column: 0 },
                      sentences: [],
                    },
                  },
                ],
              },
              {
                position: { index: 6, line: 0, column: 6 },
                morphemes: [
                  {
                    position: { index: 6, line: 0, column: 6 },
                    TUPLE: {
                      position: { index: 6, line: 0, column: 6 },
                      sentences: [
                        {
                          position: { index: 8, line: 0, column: 8 },
                          words: [
                            {
                              position: { index: 8, line: 0, column: 8 },
                              morphemes: [
                                {
                                  position: { index: 8, line: 0, column: 8 },
                                  TUPLE: {
                                    position: { index: 8, line: 0, column: 8 },
                                    sentences: [],
                                  },
                                },
                              ],
                            },
                            {
                              position: { index: 14, line: 1, column: 3 },
                              morphemes: [
                                {
                                  position: { index: 14, line: 1, column: 3 },
                                  TUPLE: {
                                    position: { index: 14, line: 1, column: 3 },
                                    sentences: [],
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("blocks", () => {
      const script = parse("{ ; } { { \n } {}}");
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    BLOCK: {
                      position: { index: 0, line: 0, column: 0 },
                      sentences: [],
                    },
                  },
                ],
              },
              {
                position: { index: 6, line: 0, column: 6 },
                morphemes: [
                  {
                    position: { index: 6, line: 0, column: 6 },
                    BLOCK: {
                      position: { index: 6, line: 0, column: 6 },
                      sentences: [
                        {
                          position: { index: 8, line: 0, column: 8 },
                          words: [
                            {
                              position: { index: 8, line: 0, column: 8 },
                              morphemes: [
                                {
                                  position: { index: 8, line: 0, column: 8 },
                                  BLOCK: {
                                    position: { index: 8, line: 0, column: 8 },
                                    sentences: [],
                                  },
                                },
                              ],
                            },
                            {
                              position: { index: 14, line: 1, column: 3 },
                              morphemes: [
                                {
                                  position: { index: 14, line: 1, column: 3 },
                                  BLOCK: {
                                    position: { index: 14, line: 1, column: 3 },
                                    sentences: [],
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("expressions", () => {
      const script = parse("[ ; ] [ [ \n ] []]");
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    EXPRESSION: {
                      position: { index: 0, line: 0, column: 0 },
                      sentences: [],
                    },
                  },
                ],
              },
              {
                position: { index: 6, line: 0, column: 6 },
                morphemes: [
                  {
                    position: { index: 6, line: 0, column: 6 },
                    EXPRESSION: {
                      position: { index: 6, line: 0, column: 6 },
                      sentences: [
                        {
                          position: { index: 8, line: 0, column: 8 },
                          words: [
                            {
                              position: { index: 8, line: 0, column: 8 },
                              morphemes: [
                                {
                                  position: { index: 8, line: 0, column: 8 },
                                  EXPRESSION: {
                                    position: { index: 8, line: 0, column: 8 },
                                    sentences: [],
                                  },
                                },
                              ],
                            },
                            {
                              position: { index: 14, line: 1, column: 3 },
                              morphemes: [
                                {
                                  position: { index: 14, line: 1, column: 3 },
                                  EXPRESSION: {
                                    position: { index: 14, line: 1, column: 3 },
                                    sentences: [],
                                  },
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("strings", () => {
      const script = parse(`"this" "is" "a\nlist $of" "" "strings"`);
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    STRING: [
                      {
                        position: { index: 1, line: 0, column: 1 },
                        LITERAL: "this",
                      },
                    ],
                  },
                ],
              },
              {
                position: { index: 7, line: 0, column: 7 },
                morphemes: [
                  {
                    position: { index: 7, line: 0, column: 7 },
                    STRING: [
                      {
                        position: { index: 8, line: 0, column: 8 },
                        LITERAL: "is",
                      },
                    ],
                  },
                ],
              },
              {
                position: { index: 12, line: 0, column: 12 },
                morphemes: [
                  {
                    position: { index: 12, line: 0, column: 12 },
                    STRING: [
                      {
                        position: { index: 13, line: 0, column: 13 },
                        LITERAL: "a\nlist ",
                      },
                      {
                        position: { index: 20, line: 1, column: 5 },
                        SUBSTITUTE_NEXT: "$",
                      },
                      {
                        position: { index: 21, line: 1, column: 6 },
                        LITERAL: "of",
                      },
                    ],
                  },
                ],
              },
              {
                position: { index: 25, line: 1, column: 10 },
                morphemes: [
                  {
                    position: { index: 25, line: 1, column: 10 },
                    STRING: [],
                  },
                ],
              },
              {
                position: { index: 28, line: 1, column: 13 },
                morphemes: [
                  {
                    position: { index: 28, line: 1, column: 13 },
                    STRING: [
                      {
                        position: { index: 29, line: 1, column: 14 },
                        LITERAL: "strings",
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("here-strings", () => {
      const script = parse(
        `"""this is""" """a\nlist"""\n  """of""" """here-strings"""`
      );
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    HERE_STRING: "this is",
                  },
                ],
              },
              {
                position: { index: 14, line: 0, column: 14 },
                morphemes: [
                  {
                    position: { index: 14, line: 0, column: 14 },
                    HERE_STRING: "a\nlist",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 29, line: 2, column: 2 },
            words: [
              {
                position: { index: 29, line: 2, column: 2 },
                morphemes: [
                  {
                    position: { index: 29, line: 2, column: 2 },
                    HERE_STRING: "of",
                  },
                ],
              },
              {
                position: { index: 38, line: 2, column: 11 },
                morphemes: [
                  {
                    position: { index: 38, line: 2, column: 11 },
                    HERE_STRING: "here-strings",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("tagged strings", () => {
      const script = parse(
        `""A\nthis is\nA"" ""B\na\nlist\nB""\n  ""C\nof\nC"" ""D\ntagged strings\nD""`
      );
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    TAGGED_STRING: "this is\n",
                  },
                ],
              },
              {
                position: { index: 16, line: 2, column: 4 },
                morphemes: [
                  {
                    position: { index: 16, line: 2, column: 4 },
                    TAGGED_STRING: "a\nlist\n",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 33, line: 6, column: 2 },
            words: [
              {
                position: { index: 33, line: 6, column: 2 },
                morphemes: [
                  {
                    position: { index: 33, line: 6, column: 2 },
                    TAGGED_STRING: "of\n",
                  },
                ],
              },
              {
                position: { index: 44, line: 8, column: 4 },
                morphemes: [
                  {
                    position: { index: 44, line: 8, column: 4 },
                    TAGGED_STRING: "tagged strings\n",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("line comments", () => {
      const script = parse(
        "# this is\n# a\\\nlist\n  ###of\n    ## line comments"
      );
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    LINE_COMMENT: " this is",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 10, line: 1, column: 0 },
            words: [
              {
                position: { index: 10, line: 1, column: 0 },
                morphemes: [
                  {
                    position: { index: 10, line: 1, column: 0 },
                    LINE_COMMENT: " a list",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 22, line: 3, column: 2 },
            words: [
              {
                position: { index: 22, line: 3, column: 2 },
                morphemes: [
                  {
                    position: { index: 22, line: 3, column: 2 },
                    LINE_COMMENT: "of",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 32, line: 4, column: 4 },
            words: [
              {
                position: { index: 32, line: 4, column: 4 },
                morphemes: [
                  {
                    position: { index: 32, line: 4, column: 4 },
                    LINE_COMMENT: " line comments",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("block comments", () => {
      const script = parse(
        "#{this is}# ##{a\nlist}##\n  #{of}# ###{block comments}###"
      );
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    BLOCK_COMMENT: "this is",
                  },
                ],
              },
              {
                position: { index: 12, line: 0, column: 12 },
                morphemes: [
                  {
                    position: { index: 12, line: 0, column: 12 },
                    BLOCK_COMMENT: "a\nlist",
                  },
                ],
              },
            ],
          },
          {
            position: { index: 27, line: 2, column: 2 },
            words: [
              {
                position: { index: 27, line: 2, column: 2 },
                morphemes: [
                  {
                    position: { index: 27, line: 2, column: 2 },
                    BLOCK_COMMENT: "of",
                  },
                ],
              },
              {
                position: { index: 34, line: 2, column: 9 },
                morphemes: [
                  {
                    position: { index: 34, line: 2, column: 9 },
                    BLOCK_COMMENT: "block comments",
                  },
                ],
              },
            ],
          },
        ],
      });
    });
    specify("substitutions", () => {
      const script = parse("$this $${is a\nlist} $*$$*$(of substitutions)");
      expect(toTree(script)).to.eql({
        position: { index: 0, line: 0, column: 0 },
        sentences: [
          {
            position: { index: 0, line: 0, column: 0 },
            words: [
              {
                position: { index: 0, line: 0, column: 0 },
                morphemes: [
                  {
                    position: { index: 0, line: 0, column: 0 },
                    SUBSTITUTE_NEXT: "$",
                  },
                  {
                    position: { index: 1, line: 0, column: 1 },
                    LITERAL: "this",
                  },
                ],
              },
              {
                position: { index: 6, line: 0, column: 6 },
                morphemes: [
                  {
                    position: { index: 6, line: 0, column: 6 },
                    SUBSTITUTE_NEXT: "$",
                  },
                  {
                    position: { index: 7, line: 0, column: 7 },
                    SUBSTITUTE_NEXT: "$",
                  },
                  {
                    position: { index: 8, line: 0, column: 8 },
                    BLOCK: {
                      position: { index: 8, line: 0, column: 8 },
                      sentences: [
                        {
                          position: { index: 9, line: 0, column: 9 },
                          words: [
                            {
                              position: { index: 9, line: 0, column: 9 },
                              morphemes: [
                                {
                                  position: { index: 9, line: 0, column: 9 },
                                  LITERAL: "is",
                                },
                              ],
                            },
                            {
                              position: { index: 12, line: 0, column: 12 },
                              morphemes: [
                                {
                                  position: { index: 12, line: 0, column: 12 },
                                  LITERAL: "a",
                                },
                              ],
                            },
                          ],
                        },
                        {
                          position: { index: 14, line: 1, column: 0 },
                          words: [
                            {
                              position: { index: 14, line: 1, column: 0 },
                              morphemes: [
                                {
                                  position: { index: 14, line: 1, column: 0 },
                                  LITERAL: "list",
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
              {
                position: { index: 20, line: 1, column: 6 },
                morphemes: [
                  {
                    position: { index: 20, line: 1, column: 6 },
                    EXPAND_NEXT: "$*",
                  },
                  {
                    position: { index: 22, line: 1, column: 8 },
                    SUBSTITUTE_NEXT: "$",
                  },
                  {
                    position: { index: 23, line: 1, column: 9 },
                    SUBSTITUTE_NEXT: "$*",
                  },
                  {
                    position: { index: 25, line: 1, column: 11 },
                    SUBSTITUTE_NEXT: "$",
                  },
                  {
                    position: { index: 26, line: 1, column: 12 },
                    TUPLE: {
                      position: { index: 26, line: 1, column: 12 },
                      sentences: [
                        {
                          position: { index: 27, line: 1, column: 13 },
                          words: [
                            {
                              position: { index: 27, line: 1, column: 13 },
                              morphemes: [
                                {
                                  position: { index: 27, line: 1, column: 13 },
                                  LITERAL: "of",
                                },
                              ],
                            },
                            {
                              position: { index: 30, line: 1, column: 16 },
                              morphemes: [
                                {
                                  position: { index: 30, line: 1, column: 16 },
                                  LITERAL: "substitutions",
                                },
                              ],
                            },
                          ],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });

  describe("source", () => {
    describe("no capturePositions", () => {
      specify("tokens", () => {
        const source: Source = { content: "cmd {arg1} arg2" };
        const { script } = parser.parseTokens(
          tokenizer.tokenize(source.content),
          source
        );
        expect(script.source).to.be.undefined;
      });
      specify("streams", () => {
        const input = new StringStream("cmd {arg1} arg2");
        const output = new ArrayTokenStream([], input.source);
        tokenizer.tokenizeStream(input, output);
        const { script } = parser.parse(output);
        expect(script.source).to.be.undefined;
      });
    });
    describe("capturePositions", () => {
      specify("tokens", () => {
        parser = new Parser({ capturePositions: true });

        const source: Source = { content: "cmd {arg1} arg2" };
        const { script } = parser.parseTokens(
          tokenizer.tokenize(source.content),
          source
        );
        expect(script.source).to.equal(source);
        expect(
          ((script.sentences[0].words[1] as Word).morphemes[0] as BlockMorpheme)
            .subscript.source
        ).to.equal(source);
      });
      specify("streams", () => {
        parser = new Parser({ capturePositions: true });

        const input = new StringStream("cmd {arg1} arg2");
        const output = new ArrayTokenStream([], input.source);
        tokenizer.tokenizeStream(input, output);
        const { script } = parser.parse(output);
        expect(script.source).to.equal(input.source);
        expect(
          ((script.sentences[0].words[1] as Word).morphemes[0] as BlockMorpheme)
            .subscript.source
        ).to.equal(input.source);
      });
    });
  });
});
