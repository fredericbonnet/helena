import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { INT, REAL, STR, StringValue } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";
import { codeBlock } from "./test-helpers";

const asString = (value) => StringValue.toString(value).data;

describe("Helena math operations", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  const init = () => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  };
  const usage = (script: string) => {
    init();
    return codeBlock(asString(evaluate("help " + script)));
  };

  beforeEach(init);

  mochadoc.section("Prefix operators", () => {
    describe("Arithmetic", () => {
      mochadoc.description(() => {
        /**
         * Helena supports the standard arithmetic operators in prefix notation.
         */
      });

      mochadoc.section("`+`", () => {
        mochadoc.description(usage("+"));

        specify("usage", () => {
          expect(evaluate("help +")).to.eql(STR("+ number ?number ...?"));
        });

        it("should accept one number", () => {
          expect(evaluate("+ 3")).to.eql(INT(3));
          expect(evaluate("+ -1.2e-3")).to.eql(REAL(-1.2e-3));
        });
        it("should add two numbers", () => {
          expect(evaluate("+ 6 23")).to.eql(INT(6 + 23));
          expect(evaluate("+ 4.5e-3 -6")).to.eql(REAL(4.5e-3 - 6));
        });
        it("should add several numbers", () => {
          const numbers = [];
          let total = 0;
          for (let i = 0; i < 10; i++) {
            const v = Math.random();
            numbers.push(v);
            total += v;
          }
          expect(evaluate("+ " + numbers.join(" "))).to.eql(REAL(total));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The command will return an error message with usage when given
             * the wrong number of arguments.
             */
            expect(execute("+")).to.eql(
              ERROR('wrong # args: should be "+ number ?number ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("+ a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });

      mochadoc.section("`-`", () => {
        mochadoc.description(usage("-"));

        specify("usage", () => {
          expect(evaluate("help -")).to.eql(STR("- number ?number ...?"));
        });

        it("should negate one number", () => {
          expect(evaluate("- 6")).to.eql(INT(-6));
          expect(evaluate("- -3.4e-5")).to.eql(REAL(3.4e-5));
        });
        it("should subtract two numbers", () => {
          expect(evaluate("- 4 12")).to.eql(INT(4 - 12));
          expect(evaluate("- 12.3e-4 -56")).to.eql(REAL(12.3e-4 + 56));
        });
        it("should subtract several numbers", () => {
          const numbers = [];
          let total = 0;
          for (let i = 0; i < 10; i++) {
            const v = Math.random();
            numbers.push(v);
            if (i == 0) total = v;
            else total -= v;
          }
          expect(evaluate("- " + numbers.join(" "))).to.eql(REAL(total));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The command will return an error message with usage when given
             * the wrong number of arguments.
             */
            expect(execute("-")).to.eql(
              ERROR('wrong # args: should be "- number ?number ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("- a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });

      mochadoc.section("`*`", () => {
        mochadoc.description(usage("*"));

        specify("usage", () => {
          expect(evaluate("help *")).to.eql(STR("* number ?number ...?"));
        });

        it("should accept one number", () => {
          expect(evaluate("* 12")).to.eql(INT(12));
          expect(evaluate("* -67.89")).to.eql(REAL(-67.89));
        });
        it("should multiply two numbers", () => {
          expect(evaluate("* 45 67")).to.eql(INT(45 * 67));
          expect(evaluate("* 1.23e-4 -56")).to.eql(REAL(1.23e-4 * -56));
        });
        it("should multiply several numbers", () => {
          const numbers = [];
          let total = 1;
          for (let i = 0; i < 10; i++) {
            const v = Math.random();
            numbers.push(v);
            total *= v;
          }
          expect(evaluate("* " + numbers.join(" "))).to.eql(REAL(total));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The command will return an error message with usage when given
             * the wrong number of arguments.
             */
            expect(execute("*")).to.eql(
              ERROR('wrong # args: should be "* number ?number ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("* a")).to.eql(ERROR('invalid number "a"'));
          });
        });
      });

      mochadoc.section("`/`", () => {
        mochadoc.description(usage("/"));

        specify("usage", () => {
          expect(evaluate("help /")).to.eql(
            STR("/ number number ?number ...?")
          );
        });

        it("should divide two numbers", () => {
          expect(evaluate("/ 12 -34")).to.eql(REAL(12 / -34));
          expect(evaluate("/ 45.67e8 -123")).to.eql(REAL(45.67e8 / -123));
        });
        it("should divide several numbers", () => {
          const numbers = [];
          let total = 0;
          for (let i = 0; i < 10; i++) {
            const v = Math.random() || 0.1;
            numbers.push(v);
            if (i == 0) total = v;
            else total /= v;
          }
          expect(evaluate("/ " + numbers.join(" "))).to.eql(REAL(total));
        });

        describe("Exceptions", () => {
          specify("wrong arity", () => {
            /**
             * The command will return an error message with usage when given
             * the wrong number of arguments.
             */
            expect(execute("/")).to.eql(
              ERROR('wrong # args: should be "/ number number ?number ...?"')
            );
            expect(execute("/ 1")).to.eql(
              ERROR('wrong # args: should be "/ number number ?number ...?"')
            );
          });
          specify("invalid value", () => {
            expect(execute("/ a 1")).to.eql(ERROR('invalid number "a"'));
            expect(execute("/ 2 b")).to.eql(ERROR('invalid number "b"'));
          });
        });
      });
    });
  });
});
