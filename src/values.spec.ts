import { expect } from "chai";
import { NIL, StringValue, TupleValue } from "./values";

describe("values", () => {
  describe("NIL", () => {
    it("should have no string representation", () => {
      expect(() => NIL.asString()).to.throw("nil has no string representation");
    });
    it("should not be index-selectable", () => {
      expect(() => NIL.selectIndex(new StringValue("index"))).to.throw(
        "nil is not index-selectable"
      );
    });
    it("should not be key-selectable", () => {
      expect(() => NIL.selectKey(new StringValue("key"))).to.throw(
        "nil is not key-selectable"
      );
    });
  });

  describe("StringValue", () => {
    it("string representation should be its value", () => {
      const string = "some string";
      const value = new StringValue(string);
      expect(value.asString()).to.eql(string);
    });
  });
});
