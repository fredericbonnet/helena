import { expect } from "chai";
import { Reference } from "./reference";
import { KeyedSelector } from "./selectors";
import { LiteralValue, Value } from "./values";

class MockReference implements Reference {
  selectedKeys: Value[] = [];
  getValue(): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(key: Value): Reference {
    this.selectedKeys.push(key);
    return this;
  }
}

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
