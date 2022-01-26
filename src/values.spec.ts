import { expect } from "chai";
import { IntegerValue, NIL, StringValue, TupleValue } from "./values";

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

  describe("IntegerValue", () => {
    it("string representation should be the decimal representation of its value", () => {
      const integer = 0x1234;
      const value = new IntegerValue(integer);
      expect(value.asString()).to.eql("4660");
    });
    it("should not be index-selectable", () => {
      const value = new IntegerValue(0);
      expect(() => value.selectIndex(new StringValue("index"))).to.throw(
        "value is not index-selectable"
      );
    });
    it("should not be key-selectable", () => {
      const value = new IntegerValue(0);
      expect(() => value.selectKey(new StringValue("key"))).to.throw(
        "value is not key-selectable"
      );
    });
  });

  describe("StringValue", () => {
    it("string representation should be its value", () => {
      const string = "some string";
      const value = new StringValue(string);
      expect(value.asString()).to.eql(string);
    });
    describe("indexed selectors", () => {
      it("should select characters by index", () => {
        const string = "some string";
        const value = new StringValue(string);
        const index = new IntegerValue(2);
        expect(value.selectIndex(index)).to.eql(new StringValue(string[2]));
      });
      it("should accept integer strings", () => {
        const string = "some string";
        const value = new StringValue(string);
        const index = new StringValue("2");
        expect(value.selectIndex(index)).to.eql(new StringValue(string[2]));
      });
      describe("exceptions", () => {
        specify("invalid index type", () => {
          const value = new StringValue("some string");
          expect(() => value.selectIndex(NIL)).to.throw(
            "nil has no string representation"
          );
        });
        specify("invalid index value", () => {
          const value = new StringValue("some string");
          const index = new StringValue("foo");
          expect(() => value.selectIndex(index)).to.throw("invalid integer");
        });
        specify("index out of range", () => {
          const string = "some string";
          const value = new StringValue(string);
          expect(() => value.selectIndex(new IntegerValue(-1))).to.throw(
            "index out of range"
          );
          expect(() =>
            value.selectIndex(new IntegerValue(string.length))
          ).to.throw("index out of range");
        });
      });
    });
    it("should not be key-selectable", () => {
      const value = new StringValue("some string");
      expect(() => value.selectKey(new StringValue("key"))).to.throw(
        "value is not key-selectable"
      );
    });
  });

  describe("TupleValue", () => {
    it("should have no string representation", () => {
      const value = new TupleValue([]);
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    describe("indexed selectors", () => {
      it("should select elements by index", () => {
        const values = [new StringValue("value1"), new StringValue("value2")];
        const value = new TupleValue(values);
        const index = new IntegerValue(1);
        expect(value.selectIndex(index)).to.eql(values[1]);
      });
      it("should accept integer strings", () => {
        const values = [new StringValue("value1"), new StringValue("value2")];
        const value = new TupleValue(values);
        const index = new StringValue("0");
        expect(value.selectIndex(index)).to.eql(values[0]);
      });
      describe("exceptions", () => {
        specify("invalid index type", () => {
          const value = new TupleValue([]);
          expect(() => value.selectIndex(NIL)).to.throw(
            "nil has no string representation"
          );
        });
        specify("invalid index value", () => {
          const value = new TupleValue([]);
          const index = new StringValue("foo");
          expect(() => value.selectIndex(index)).to.throw("invalid integer");
        });
        specify("index out of range", () => {
          const values = [new StringValue("value1"), new StringValue("value2")];
          const value = new TupleValue(values);
          expect(() => value.selectIndex(new IntegerValue(-1))).to.throw(
            "index out of range"
          );
          expect(() =>
            value.selectIndex(new IntegerValue(values.length))
          ).to.throw("index out of range");
        });
      });
    });
    it("should not be key-selectable", () => {
      const value = new TupleValue([]);
      expect(() => value.selectKey(new StringValue("key"))).to.throw(
        "value is not key-selectable"
      );
    });
  });
});
