import { expect } from "chai";
import { Reference } from "./reference";
import { IndexedSelector, KeyedSelector } from "./selectors";
import { LiteralValue, NIL, TupleValue, Value } from "./values";

class MockReference implements Reference {
  selectedIndex: Value;
  selectedKeys: Value[] = [];
  getValue(): Value {
    throw new Error("Method not implemented.");
  }
  selectIndex(index: Value): Reference {
    this.selectedIndex = index;
    return this;
  }
  selectKey(key: Value): Reference {
    this.selectedKeys.push(key);
    return this;
  }
}

describe("IndexedSelector", () => {
  specify("literal index", () => {
    const index = new LiteralValue("index");
    const selector = new IndexedSelector(index);
    const reference = new MockReference();
    expect(selector.apply(reference)).to.eql(reference);
    expect(reference.selectedIndex).to.eql(index);
  });
  describe("exceptions", () => {
    specify("invalid index", () => {
      expect(() => new IndexedSelector(NIL)).to.throws("invalid index");
    });
  });
});

describe("KeyedSelector", () => {
  specify("one key", () => {
    const keys = [new LiteralValue("key")];
    const selector = new KeyedSelector(keys);
    const reference = new MockReference();
    expect(selector.apply(reference)).to.eql(reference);
    expect(reference.selectedKeys).to.eql(keys);
  });
  specify("multiple keys", () => {
    const keys = [new LiteralValue("key1"), new LiteralValue("key2")];
    const selector = new KeyedSelector(keys);
    const reference = new MockReference();
    expect(selector.apply(reference)).to.eql(reference);
    expect(reference.selectedKeys).to.eql(keys);
  });
  describe("exceptions", () => {
    specify("empty key list", () => {
      expect(() => new KeyedSelector([])).to.throws("empty selector");
    });
  });
});
