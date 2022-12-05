import { expect } from "chai";
import { ERROR } from "../core/results";
import { Parser } from "../core/parser";
import { Tokenizer } from "../core/tokenizer";
import {
  FALSE,
  ListValue,
  MapValue,
  NIL,
  StringValue,
  TRUE,
} from "../core/values";
import { Scope, Variable } from "./core";
import { initCommands } from "./helena-dialect";

describe("Helena constants and variables", () => {
  let rootScope: Scope;

  let tokenizer: Tokenizer;
  let parser: Parser;

  const parse = (script: string) =>
    parser.parse(tokenizer.tokenize(script)).script;
  const execute = (script: string) => rootScope.executeScript(parse(script));
  const evaluate = (script: string) => execute(script).value;

  beforeEach(() => {
    rootScope = new Scope();
    initCommands(rootScope);

    tokenizer = new Tokenizer();
    parser = new Parser();
  });

  describe("let", () => {
    it("should define the value of a new constant", () => {
      evaluate("let cst val");
      expect(rootScope.context.constants.get("cst")).to.eql(
        new StringValue("val")
      );
    });
    it("should return the constant value", () => {
      expect(evaluate("let cst val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("existing constant", () => {
        rootScope.context.constants.set("cst", new StringValue("old"));
        expect(execute("let cst val")).to.eql(
          ERROR('cannot redefine constant "cst"')
        );
      });
      specify("existing variable", () => {
        rootScope.context.variables.set(
          "var",
          new Variable(new StringValue("old"))
        );
        expect(execute("let var val")).to.eql(
          ERROR('cannot define constant "var": variable already exists')
        );
      });
      specify("wrong arity", () => {
        expect(execute("let")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
        expect(execute("let a")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
        expect(execute("let a b c")).to.eql(
          ERROR('wrong # args: should be "let constname value"')
        );
      });
    });
  });
  describe("set", () => {
    it("should set the value of a new variable", () => {
      evaluate("set var val");
      expect(rootScope.context.variables.get("var")).to.eql(
        new Variable(new StringValue("val"))
      );
    });
    it("should overwrite the value of an existing variable", () => {
      rootScope.context.variables.set(
        "var",
        new Variable(new StringValue("old"))
      );
      evaluate("set var val");
      expect(rootScope.context.variables.get("var")).to.eql(
        new Variable(new StringValue("val"))
      );
    });
    it("should return the set value", () => {
      expect(evaluate("set var val")).to.eql(new StringValue("val"));
    });
    describe("exceptions", () => {
      specify("existing constant", () => {
        rootScope.context.constants.set("cst", new StringValue("old"));
        expect(execute("set cst val")).to.eql(
          ERROR('cannot redefine constant "cst"')
        );
      });
      specify("wrong arity", () => {
        expect(execute("set")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
        expect(execute("set a")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
        expect(execute("set a b c")).to.eql(
          ERROR('wrong # args: should be "set varname value"')
        );
      });
    });
  });
  describe("get", () => {
    it("should return the value of an existing variable", () => {
      evaluate("let cst val");
      expect(evaluate("get cst")).to.eql(new StringValue("val"));
    });
    it("should return the value of an existing constant", () => {
      evaluate("set var val");
      expect(evaluate("get var")).to.eql(new StringValue("val"));
    });
    it("should return the default value for a non-existing variable", () => {
      expect(evaluate("get var default")).to.eql(new StringValue("default"));
      expect(evaluate("get var(key) default")).to.eql(
        new StringValue("default")
      );
      expect(evaluate("get var[1] default")).to.eql(new StringValue("default"));
    });
    it("should support name tuples", () => {
      evaluate("set var1 val1");
      evaluate("set var2 val2");
      evaluate("set var3 val3");
      expect(evaluate("get (var1 (var2 var3))")).to.eql(
        evaluate("idem (val1 (val2 val3))")
      );
    });
    describe("should support qualified names", () => {
      specify("indexed selector", () => {
        rootScope.setVariable(
          "var",
          new ListValue([new StringValue("val1"), new StringValue("val2")])
        );
        expect(evaluate("get var[1]")).to.eql(new StringValue("val2"));
      });
      specify("keyed selector", () => {
        rootScope.setVariable(
          "var",
          new MapValue({ key: new StringValue("val") })
        );
        expect(evaluate("get var(key)")).to.eql(new StringValue("val"));
      });
      specify("complex case", () => {
        rootScope.setVariable(
          "var1",
          new ListValue([new StringValue("val1"), new StringValue("val2")])
        );
        rootScope.setVariable(
          "var2",
          new ListValue([new StringValue("val3"), new StringValue("val4")])
        );
        rootScope.setVariable(
          "var3",
          new ListValue([new StringValue("val5"), new StringValue("val6")])
        );
        expect(evaluate("get (var1 (var2 var3))[1]")).to.eql(
          evaluate("idem (val2 (val4 val6))")
        );
        expect(evaluate("get (var1[1])")).to.eql(evaluate("idem (val2)"));
      });
    });
    it("should return the default value when a selector fails", () => {
      rootScope.setConstant("l", new ListValue([]));
      rootScope.setConstant("m", new MapValue({}));
      expect(evaluate("get l[1] default")).to.eql(new StringValue("default"));
      expect(evaluate("get l(key) default")).to.eql(new StringValue("default"));
      expect(evaluate("get m[1] default")).to.eql(new StringValue("default"));
      expect(evaluate("get m(key) default")).to.eql(new StringValue("default"));
    });
    describe("exceptions", () => {
      specify("non-existing variable", () => {
        expect(execute("get unknownVariable")).to.eql(
          ERROR('cannot get "unknownVariable": no such variable')
        );
      });
      specify("wrong arity", () => {
        expect(execute("get")).to.eql(
          ERROR('wrong # args: should be "get varname ?default?"')
        );
        expect(execute("get a b c")).to.eql(
          ERROR('wrong # args: should be "get varname ?default?"')
        );
      });
      specify("name tuples with default", () => {
        expect(execute("get (var) default")).to.eql(
          ERROR("cannot use default with name tuples")
        );
      });
    });
  });
  describe("exists", () => {
    it("should return true for an existing variable", () => {
      evaluate("let cst val");
      expect(evaluate("exists cst")).to.eql(TRUE);
    });
    it("should return true for an existing constant", () => {
      evaluate("set var val");
      expect(evaluate("exists var")).to.eql(TRUE);
    });
    it("should return false for a non-existing variable", () => {
      expect(evaluate("exists var")).to.eql(FALSE);
      expect(evaluate("exists var(key)")).to.eql(FALSE);
      expect(evaluate("exists var[1]")).to.eql(FALSE);
    });
    describe("should support qualified names", () => {
      specify("indexed selector", () => {
        rootScope.setVariable(
          "var",
          new ListValue([new StringValue("val1"), new StringValue("val2")])
        );
        expect(evaluate("exists var[1]")).to.eql(TRUE);
      });
      specify("keyed selector", () => {
        rootScope.setVariable(
          "var",
          new MapValue({ key: new StringValue("val") })
        );
        expect(evaluate("exists var(key)")).to.eql(TRUE);
      });
    });
    it("should return false when a selector fails", () => {
      rootScope.setConstant("l", new ListValue([]));
      rootScope.setConstant("m", new MapValue({}));
      expect(evaluate("exists l[1]")).to.eql(FALSE);
      expect(evaluate("exists l(key)")).to.eql(FALSE);
      expect(evaluate("exists m[1]")).to.eql(FALSE);
      expect(evaluate("exists m(key)")).to.eql(FALSE);
    });
    describe("exceptions", () => {
      specify("wrong arity", () => {
        expect(execute("exists")).to.eql(
          ERROR('wrong # args: should be "exists varname"')
        );
        expect(execute("exists a b")).to.eql(
          ERROR('wrong # args: should be "exists varname"')
        );
      });
      specify("name tuples", () => {
        expect(execute("exists (var)")).to.eql(ERROR("invalid value"));
      });
    });
  });
  describe("unset", () => {
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
    describe("exceptions", () => {
      specify("existing constant", () => {
        rootScope.context.constants.set("cst", new StringValue("old"));
        expect(execute("unset cst")).to.eql(
          ERROR('cannot unset constant "cst"')
        );
      });
      specify("non-existing variable", () => {
        expect(execute("unset unknownVariable")).to.eql(
          ERROR('cannot unset "unknownVariable": no such variable')
        );
      });
      specify("wrong arity", () => {
        expect(execute("unset")).to.eql(
          ERROR('wrong # args: should be "unset varname"')
        );
        expect(execute("unset a b")).to.eql(
          ERROR('wrong # args: should be "unset varname"')
        );
      });
    });
  });
});
