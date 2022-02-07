import { expect } from "chai";
import {
  IntegerValue,
  NIL,
  ReferenceValue,
  StringValue,
  ListValue,
  TupleValue,
  MapValue,
} from "./values";

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

  describe("ListValue", () => {
    it("should have no string representation", () => {
      const value = new ListValue([]);
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    describe("indexed selectors", () => {
      it("should select elements by index", () => {
        const values = [new StringValue("value1"), new StringValue("value2")];
        const value = new ListValue(values);
        const index = new IntegerValue(1);
        expect(value.selectIndex(index)).to.eql(values[1]);
      });
      it("should accept integer strings", () => {
        const values = [new StringValue("value1"), new StringValue("value2")];
        const value = new ListValue(values);
        const index = new StringValue("0");
        expect(value.selectIndex(index)).to.eql(values[0]);
      });
      describe("exceptions", () => {
        specify("invalid index type", () => {
          const value = new ListValue([]);
          expect(() => value.selectIndex(NIL)).to.throw(
            "nil has no string representation"
          );
        });
        specify("invalid index value", () => {
          const value = new ListValue([]);
          const index = new StringValue("foo");
          expect(() => value.selectIndex(index)).to.throw("invalid integer");
        });
        specify("index out of range", () => {
          const values = [new StringValue("value1"), new StringValue("value2")];
          const value = new ListValue(values);
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
      const value = new ListValue([]);
      expect(() => value.selectKey(new StringValue("key"))).to.throw(
        "value is not key-selectable"
      );
    });
  });

  describe("MapValue", () => {
    it("should have no string representation", () => {
      const value = new MapValue({});
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    it("should not be index-selectable", () => {
      const value = new MapValue({});
      expect(() => value.selectIndex(new StringValue("index"))).to.throw(
        "value is not index-selectable"
      );
    });
    describe("keyed selectors", () => {
      it("should select elements by key", () => {
        const values = {
          key1: new StringValue("value1"),
          key2: new StringValue("value2"),
        };
        const value = new MapValue(values);
        const key = new StringValue("key1");
        expect(value.selectKey(key)).to.eql(values["key1"]);
      });
      describe("exceptions", () => {
        specify("invalid key type", () => {
          const value = new MapValue({});
          expect(() => value.selectKey(NIL)).to.throw(
            "nil has no string representation"
          );
        });
        specify("unknown key value", () => {
          const value = new MapValue({});
          const index = new StringValue("foo");
          expect(() => value.selectKey(index)).to.throw("unknown key");
        });
      });
    });
    it("should not be key-selectable", () => {
      const value = new ListValue([]);
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
    it("should not be index-selectable", () => {
      const value = new TupleValue([]);
      expect(() => value.selectIndex(new StringValue("index"))).to.throw(
        "value is not index-selectable"
      );
    });
    it("should not be key-selectable", () => {
      const value = new TupleValue([]);
      expect(() => value.selectKey(new StringValue("key"))).to.throw(
        "value is not key-selectable"
      );
    });
  });

  describe("ReferenceValue", () => {
    it("should have no string representation", () => {
      const value = new ReferenceValue(new StringValue("name"), []);
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    it("should not be index-selectable", () => {
      const value = new ReferenceValue(new StringValue("name"), []);
      expect(() => value.selectIndex(new StringValue("index"))).to.throw(
        "value is not index-selectable"
      );
    });
    it("should not be key-selectable", () => {
      const value = new ReferenceValue(new StringValue("name"), []);
      expect(() => value.selectKey(new StringValue("key"))).to.throw(
        "value is not key-selectable"
      );
    });
  });
});
