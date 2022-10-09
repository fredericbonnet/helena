import { ResultCode } from "../core/command";
import { CompilingEvaluator, InlineEvaluator } from "../core/evaluator";
import { Parser } from "../core/parser";
import { Scope, initCommands } from "./helena-dialect";
import { Tokenizer } from "../core/tokenizer";

describe("Helena dialect", () => {
  for (const klass of [InlineEvaluator, CompilingEvaluator]) {
    describe(klass.name, () => {
      let rootScope: Scope;

      let tokenizer: Tokenizer;
      let parser: Parser;

      const parse = (script: string) =>
        parser.parse(tokenizer.tokenize(script));
      const execute = (script: string) =>
        rootScope.execute(rootScope.compile(parse(script)));
      const evaluate = (script: string) => {
        const result = execute(script);
        if (result.code == ResultCode.ERROR)
          throw new Error(result.value.asString());
        return result.value;
      };

      beforeEach(() => {
        rootScope = new Scope();
        initCommands(rootScope);

        tokenizer = new Tokenizer();
        parser = new Parser();
      });

      // TODO example scripts
    });
  }
});
