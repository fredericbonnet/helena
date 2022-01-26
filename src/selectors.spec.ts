import { expect } from "chai";
import { IndexedSelector, KeyedSelector } from "./selectors";
import { StringValue, NIL, Value, ValueType } from "./values";

class MockValue implements Value {
  type = ValueType.CUSTOM;
  selectedIndex: Value;
  selectedKeys: Value[] = [];
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(index: Value): Value {
    this.selectedIndex = index;
    return this;
  }
  selectKey(key: Value): Value {
    this.selectedKeys.push(key);
    return this;
  }
}

describe("IndexedSelector", () => {
  specify("literal index", () => {
    const index = new StringValue("index");
    const selector = new IndexedSelector(index);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(value);
    expect(value.selectedIndex).to.eql(index);
  });
  describe("exceptions", () => {
    specify("invalid index", () => {
      expect(() => new IndexedSelector(NIL)).to.throws("invalid index");
    });
  });
});

describe("KeyedSelector", () => {
  specify("one key", () => {
    const keys = [new StringValue("key")];
    const selector = new KeyedSelector(keys);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(value);
    expect(value.selectedKeys).to.eql(keys);
  });
  specify("multiple keys", () => {
    const keys = [new StringValue("key1"), new StringValue("key2")];
    const selector = new KeyedSelector(keys);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(value);
    expect(value.selectedKeys).to.eql(keys);
  });
  describe("exceptions", () => {
    specify("empty key list", () => {
      expect(() => new KeyedSelector([])).to.throws("empty selector");
    });
  });
});
