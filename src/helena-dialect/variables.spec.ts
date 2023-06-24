import { expect } from "chai";
import * as mochadoc from "../../mochadoc";
import { ERROR, ResultCode } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import { FALSE, LIST, MAP, NIL, STR, TRUE } from "../core/values";
import { Scope } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena constants and variables", () => {
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
    return "```lna\n" + evaluate("help " + script).asString() + "\n```";
  };

  beforeEach(init);

  describe("`let`", () => {
    mochadoc.summary("Define a constant");
    mochadoc.usage(usage("let"));
    mochadoc.description(() => {
      /**
       * The `let` command defines a new constant by associating a variable name
       * to a constant value.
       */
    });

    describe("Specifications", () => {
      // mochadoc.summary("foo");
      specify("usage", () => {
        expect(evaluate("help let")).to.eql(STR("let constname value"));
        expect(evaluate("help let name")).to.eql(STR("let constname value"));
        expect(evaluate("help let name val")).to.eql(
          STR("let constname value")
        );
      });

      it("should define the value of a new constant", () => {
        evaluate("let cst val");
        expect(rootScope.context.constants.get("cst")).to.eql(STR("val"));
      });
      it("should return the constant value", () => {
        expect(evaluate("let cst val")).to.eql(STR("val"));
      });

      describe("Tuple destructuring", () => {
        mochadoc.description(() => {
          /**
           * You can define several constants at once by passing name and value
           * tuples. This also works recursively.
           */
        });

        it("should define several constants at once", () => {
          expect(execute("let (var1 var2 var3) (val1 val2 val3)")).to.eql(
            execute("idem (val1 val2 val3)")
          );
          expect(evaluate("get var1")).to.eql(STR("val1"));
          expect(evaluate("get var2")).to.eql(STR("val2"));
          expect(evaluate("get var3")).to.eql(STR("val3"));
        });
        it("should work recursively", () => {
          expect(execute("let (var1 (var2 var3)) (val1 (val2 val3))")).to.eql(
            execute("idem (val1 (val2 val3))")
          );
          expect(evaluate("get var1")).to.eql(STR("val1"));
          expect(evaluate("get var2")).to.eql(STR("val2"));
          expect(evaluate("get var3")).to.eql(STR("val3"));
        });
        it("should support setting a constant to a tuple value", () => {
          expect(execute("let (var1 var2) (val1 (val2 val3))")).to.eql(
            execute("idem (val1 (val2 val3))")
          );
          expect(evaluate("get var1")).to.eql(STR("val1"));
          expect(evaluate("get var2")).to.eql(evaluate("idem (val2 val3)"));
        });
        it("should not define constants in case of missing value", () => {
          expect(execute("let (var1 var2) (val1)")).to.eql(
            ERROR("bad value shape")
          );
          expect(rootScope.context.variables.has("var1")).to.be.false;
          expect(rootScope.context.variables.has("var2")).to.be.false;
        });
        it("should not define constants in case of missing subvalue", () => {
          expect(execute("let (var1 (var2 var3)) (val1 (val2))")).to.eql(
            ERROR("bad value shape")
          );
          expect(rootScope.context.constants.has("var1")).to.be.false;
          expect(rootScope.context.constants.has("var2")).to.be.false;
          expect(rootScope.context.constants.has("var3")).to.be.false;
        });
        it("should not define constants in case of bad shape", () => {
          expect(execute("let (var1 (var2)) (val1 val2)")).to.eql(
            ERROR("bad value shape")
          );
          expect(rootScope.context.constants.has("var1")).to.be.false;
          expect(rootScope.context.constants.has("var2")).to.be.false;
        });
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("let")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
        expect(execute("let a")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
        expect(execute("let a b c")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
        expect(execute("help let a b c")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
      });
      specify("existing constant", () => {
        /**
         * The command cannot redefine an existing constant.
         */
        rootScope.context.constants.set("cst", STR("old"));
        expect(execute("let cst val")).to.eql(
          ERROR('cannot redefine constant "cst"')
        );
      });
      specify("existing variable", () => {
        /**
         * The command cannot redefine an existing variable.
         */
        rootScope.context.variables.set("var", STR("old"));
        expect(execute("let var val")).to.eql(
          ERROR('cannot define constant "var": variable already exists')
        );
      });
      specify("bad tuple shape", () => {
        /**
         * The shape of the name tuple must be a subset of the shape of the
         * value tuple, missing values are not allowed.
         */
        expect(execute("let (a) b")).to.eql(ERROR("bad value shape"));
        expect(execute("let ((a)) (b)")).to.eql(ERROR("bad value shape"));
        expect(execute("let (a) ()")).to.eql(ERROR("bad value shape"));
      });
      specify("invalid constant name", () => {
        /**
         * Constant names must have a valid string representation.
         */
        expect(execute("let [] val")).to.eql(ERROR("invalid constant name"));
        expect(execute("let ([]) (val)")).to.eql(
          ERROR("invalid constant name")
        );
      });
    });
  });

  describe("`set`", () => {
    mochadoc.summary("Define or set a variable");
    mochadoc.usage(usage("set"));
    mochadoc.description(() => {
      /**
       * The `set` command defines a new variable or redefines an existing one
       * by associating a variable name to a value.
       */
    });

    describe("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help set")).to.eql(STR("set varname value"));
        expect(evaluate("help set name")).to.eql(STR("set varname value"));
        expect(evaluate("help set name val")).to.eql(STR("set varname value"));
      });

      it("should set the value of a new variable", () => {
        evaluate("set var val");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
      });
      it("should redefine the value of an existing variable", () => {
        rootScope.context.variables.set("var", STR("old"));
        evaluate("set var val");
        expect(rootScope.context.variables.get("var")).to.eql(STR("val"));
      });
      it("should return the set value", () => {
        expect(evaluate("set var val")).to.eql(STR("val"));
      });

      describe("Tuple destructuring", () => {
        mochadoc.description(() => {
          /**
           * You can set several variables at once by passing name and value
           * tuples. This also works recursively.
           */
        });

        it("should set several variables at once", () => {
          expect(execute("set (var1 var2 var3) (val1 val2 val3)")).to.eql(
            execute("idem (val1 val2 val3)")
          );
          expect(evaluate("get var1")).to.eql(STR("val1"));
          expect(evaluate("get var2")).to.eql(STR("val2"));
          expect(evaluate("get var3")).to.eql(STR("val3"));
        });
        it("should work recursively", () => {
          expect(execute("set (var1 (var2 var3)) (val1 (val2 val3))")).to.eql(
            execute("idem (val1 (val2 val3))")
          );
          expect(evaluate("get var1")).to.eql(STR("val1"));
          expect(evaluate("get var2")).to.eql(STR("val2"));
          expect(evaluate("get var3")).to.eql(STR("val3"));
        });
        it("should support setting a variable to a tuple value", () => {
          expect(execute("set (var1 var2) (val1 (val2 val3))")).to.eql(
            execute("idem (val1 (val2 val3))")
          );
          expect(evaluate("get var1")).to.eql(STR("val1"));
          expect(evaluate("get var2")).to.eql(evaluate("idem (val2 val3)"));
        });
        it("should not set variables in case of missing value", () => {
          expect(execute("set (var1 var2) (val1)")).to.eql(
            ERROR("bad value shape")
          );
          expect(rootScope.context.variables.has("var1")).to.be.false;
          expect(rootScope.context.variables.has("var2")).to.be.false;
        });
        it("should not set variables in case of missing subvalue", () => {
          expect(execute("set (var1 (var2 var3)) (val1 (val2))")).to.eql(
            ERROR("bad value shape")
          );
          expect(rootScope.context.variables.has("var1")).to.be.false;
          expect(rootScope.context.variables.has("var2")).to.be.false;
          expect(rootScope.context.variables.has("var3")).to.be.false;
        });
        it("should not set variables in case of bad shape", () => {
          expect(execute("set (var1 (var2)) (val1 val2)")).to.eql(
            ERROR("bad value shape")
          );
          expect(rootScope.context.variables.has("var1")).to.be.false;
          expect(rootScope.context.variables.has("var2")).to.be.false;
        });
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("set")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
        expect(execute("set a")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
        expect(execute("set a b c")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
        expect(execute("help set a b c")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
      });
      specify("existing constant", () => {
        rootScope.context.constants.set("cst", STR("old"));
        expect(execute("set cst val")).to.eql(
          ERROR('cannot redefine constant "cst"')
        );
        /**
         * The command cannot redefine an existing constant.
         */
      });
      specify("bad tuple shape", () => {
        /**
         * The shape of the name tuple must be a subset of the shape of the
         * value tuple, missing values are not allowed.
         */
        expect(execute("set (a) b")).to.eql(ERROR("bad value shape"));
        expect(execute("set ((a)) (b)")).to.eql(ERROR("bad value shape"));
        expect(execute("set (a) ()")).to.eql(ERROR("bad value shape"));
      });
      specify("invalid variable name", () => {
        /**
         * Variable names must have a valid string representation.
         */
        expect(execute("set [] val")).to.eql(ERROR("invalid variable name"));
        expect(execute("set ([]) (val)")).to.eql(
          ERROR("invalid variable name")
        );
      });
    });
  });

  describe("`get`", () => {
    mochadoc.summary("Get a constant or variable value");
    mochadoc.usage(usage("get"));
    mochadoc.description(() => {
      /**
       * The `get` command gets the value of an existing constant or variable.
       */
    });

    describe("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help get")).to.eql(STR("get varname ?default?"));
        expect(evaluate("help get name")).to.eql(STR("get varname ?default?"));
        expect(evaluate("help get name val")).to.eql(
          STR("get varname ?default?")
        );
      });

      it("should return the value of an existing variable", () => {
        evaluate("let cst val");
        expect(evaluate("get cst")).to.eql(STR("val"));
      });
      it("should return the value of an existing constant", () => {
        evaluate("set var val");
        expect(evaluate("get var")).to.eql(STR("val"));
      });
      it("should return the default value for a unknown variable", () => {
        expect(evaluate("get var default")).to.eql(STR("default"));
        expect(evaluate("get var(key) default")).to.eql(STR("default"));
        expect(evaluate("get var[1] default")).to.eql(STR("default"));
      });

      describe("Qualified names", () => {
        mochadoc.description(() => {
          /**
           * Passing a qualified name will apply its selectors to the variable
           * value.
           */
        });

        specify("indexed selector", () => {
          rootScope.setNamedVariable("var", LIST([STR("val1"), STR("val2")]));
          expect(evaluate("get var[1]")).to.eql(STR("val2"));
        });
        specify("keyed selector", () => {
          rootScope.setNamedVariable("var", MAP({ key: STR("val") }));
          expect(evaluate("get var(key)")).to.eql(STR("val"));
        });
        specify("should work recursively", () => {
          rootScope.setNamedVariable(
            "var",
            MAP({ key: LIST([STR("val1"), STR("val2")]) })
          );
          expect(evaluate("get var(key)[1]")).to.eql(STR("val2"));
        });
        it("should return the default value when a selector fails", () => {
          rootScope.setNamedConstant("l", LIST([]));
          rootScope.setNamedConstant("m", MAP({}));
          expect(evaluate("get l[1] default")).to.eql(STR("default"));
          expect(evaluate("get l(key) default")).to.eql(STR("default"));
          expect(evaluate("get l[0](key) default")).to.eql(STR("default"));
          expect(evaluate("get m[1] default")).to.eql(STR("default"));
          expect(evaluate("get m(key) default")).to.eql(STR("default"));
        });
      });

      describe("Tuple destructuring", () => {
        mochadoc.description(() => {
          /**
           * You can get several variables at once by passing a name tuple. This
           * also works recursively.
           */
        });

        it("should get several variables at once", () => {
          evaluate("set var1 val1");
          evaluate("set var2 val2");
          evaluate("set var3 val3");
          expect(execute("get (var1 var2 var3)")).to.eql(
            execute("idem (val1 val2 val3)")
          );
        });
        it("should work recursively", () => {
          evaluate("set var1 val1");
          evaluate("set var2 val2");
          evaluate("set var3 val3");
          expect(execute("get (var1 (var2 var3))")).to.eql(
            execute("idem (val1 (val2 val3))")
          );
        });
        it("should support qualified names", () => {
          rootScope.setNamedVariable("var1", LIST([STR("val1"), STR("val2")]));
          rootScope.setNamedVariable("var2", LIST([STR("val3"), STR("val4")]));
          rootScope.setNamedVariable("var3", LIST([STR("val5"), STR("val6")]));
          expect(evaluate("get (var1 (var2 var3))[1]")).to.eql(
            evaluate("idem (val2 (val4 val6))")
          );
          expect(evaluate("get (var1[1])")).to.eql(evaluate("idem (val2)"));
        });
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("get")).to.eql(
          ERROR('wrong # args: should be "get varname ?default?"')
        );
        expect(execute("get a b c")).to.eql(
          ERROR('wrong # args: should be "get varname ?default?"')
        );
        expect(execute("help get a b c")).to.eql(
          ERROR('wrong # args: should be "get varname ?default?"')
        );
      });
      specify("unknown variable", () => {
        /**
         * The command will return an error when getting an unknown variable
         * without passing a default value.
         */
        expect(execute("get unknownVariable")).to.eql(
          ERROR('cannot get "unknownVariable": no such variable')
        );
      });
      specify("bad selector", () => {
        /**
         * The command will return an error when a qualified name selector
         * fails without passing a default value.
         */
        rootScope.setNamedConstant("l", LIST([]));
        rootScope.setNamedConstant("m", MAP({}));
        expect(execute("get l[1]").code).to.eql(ResultCode.ERROR);
        expect(execute("get l(key)").code).to.eql(ResultCode.ERROR);
        expect(execute("get m[1]").code).to.eql(ResultCode.ERROR);
        expect(execute("get m(key)").code).to.eql(ResultCode.ERROR);
      });
      specify("name tuples with default", () => {
        /**
         * Default values are not supported with name tuples.
         */
        expect(execute("get (var) default")).to.eql(
          ERROR("cannot use default with name tuples")
        );
      });
    });
  });

  describe("`exists`", () => {
    mochadoc.summary("Test for existence of a variable");
    mochadoc.usage(usage("exists"));
    mochadoc.description(() => {
      /**
       * The `exists` command tests wether a variable or constant exists.
       */
    });

    describe("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help exists")).to.eql(STR("exists varname"));
        expect(evaluate("help exists name")).to.eql(STR("exists varname"));
      });

      it("should return `true` for an existing variable", () => {
        evaluate("let cst val");
        expect(evaluate("exists cst")).to.eql(TRUE);
      });
      it("should return `true` for an existing constant", () => {
        evaluate("set var val");
        expect(evaluate("exists var")).to.eql(TRUE);
      });
      it("should return `false` for a unknown variable", () => {
        expect(evaluate("exists var")).to.eql(FALSE);
        expect(evaluate("exists var(key)")).to.eql(FALSE);
        expect(evaluate("exists var[1]")).to.eql(FALSE);
      });

      describe("Qualified names", () => {
        mochadoc.description(() => {
          /**
           * Passing a qualified name will apply its selectors to the variable
           * value.
           */
        });
        specify("indexed selector", () => {
          rootScope.setNamedVariable("var", LIST([STR("val1"), STR("val2")]));
          expect(evaluate("exists var[1]")).to.eql(TRUE);
        });
        specify("keyed selector", () => {
          rootScope.setNamedVariable("var", MAP({ key: STR("val") }));
          expect(evaluate("exists var(key)")).to.eql(TRUE);
        });
        specify("recursive selectors", () => {
          rootScope.setNamedVariable(
            "var",
            MAP({ key: LIST([STR("val1"), STR("val2")]) })
          );
          expect(evaluate("exists var(key)[1]")).to.eql(TRUE);
        });
        it("should return `false` for a unknown variable", () => {
          expect(evaluate("exists var[1]")).to.eql(FALSE);
          expect(evaluate("exists var(key)")).to.eql(FALSE);
        });
        it("should return `false` when a selector fails", () => {
          rootScope.setNamedConstant("l", LIST([]));
          rootScope.setNamedConstant("m", MAP({}));
          expect(evaluate("exists l[1]")).to.eql(FALSE);
          expect(evaluate("exists l(key)")).to.eql(FALSE);
          expect(evaluate("exists m[1]")).to.eql(FALSE);
          expect(evaluate("exists m(key)")).to.eql(FALSE);
        });
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("exists")).to.eql(
          ERROR('wrong # args: should be "exists varname"')
        );
        expect(execute("exists a b")).to.eql(
          ERROR('wrong # args: should be "exists varname"')
        );
        expect(execute("help exists a b")).to.eql(
          ERROR('wrong # args: should be "exists varname"')
        );
      });
      specify("name tuples", () => {
        /**
         * Name tuples are not supported.
         */
        expect(execute("exists (var)")).to.eql(ERROR("invalid value"));
      });
    });
  });

  describe("`unset`", () => {
    mochadoc.summary("Undefine a variable");
    mochadoc.usage(usage("unset"));
    mochadoc.description(() => {
      /**
       * The `unset` command undefines an existing variable.
       */
    });

    describe("Specifications", () => {
      specify("usage", () => {
        expect(evaluate("help unset")).to.eql(STR("unset varname"));
        expect(evaluate("help unset name")).to.eql(STR("unset varname"));
      });

      it("should unset an existing variable", () => {
        evaluate("set var val");
        expect(evaluate("exists var")).to.eql(TRUE);
        evaluate("unset var");
        expect(evaluate("exists var")).to.eql(FALSE);
      });
      it("should return nil", () => {
        evaluate("set var val");
        expect(evaluate("unset var")).to.eql(NIL);
      });
    });

    describe("Exceptions", () => {
      specify("wrong arity", () => {
        /**
         * The command will return an error message with usage when given the
         * wrong number of arguments.
         */
        expect(execute("unset")).to.eql(
          ERROR('wrong # args: should be "unset varname"')
        );
        expect(execute("unset a b")).to.eql(
          ERROR('wrong # args: should be "unset varname"')
        );
        expect(execute("help unset a b")).to.eql(
          ERROR('wrong # args: should be "unset varname"')
        );
      });
      specify("existing constant", () => {
        /**
         * The command cannot undefine a constant.
         */
        rootScope.context.constants.set("cst", STR("old"));
        expect(execute("unset cst")).to.eql(
          ERROR('cannot unset constant "cst"')
        );
      });
      specify("unknown variable", () => {
        /**
         * The command cannot undefine an unknown variable.
         */
        expect(execute("unset unknownVariable")).to.eql(
          ERROR('cannot unset "unknownVariable": no such variable')
        );
      });
      specify("qualified name", () => {
        /**
         * The command cannot undefine a selected variable.
         */
        rootScope.setNamedVariable("var", LIST([STR("val1"), STR("val2")]));
        rootScope.setNamedVariable("var", MAP({ key: STR("val") }));
        expect(execute("unset var[1]")).to.eql(ERROR("invalid variable name"));
        expect(execute("unset var(key)")).to.eql(
          ERROR("invalid variable name")
        );
      });
      specify("invalid variable name", () => {
        /**
         * Variable names must have a valid string representation.
         */
        expect(execute("unset []")).to.eql(ERROR("invalid variable name"));
      });
    });
  });
});
