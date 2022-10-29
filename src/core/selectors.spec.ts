import { expect } from "chai";
import { OK, Result } from "./command";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";
import {
  NIL,
  Value,
  ValueType,
  StringValue,
  TupleValue,
  IntegerValue,
} from "./values";

class MockValue implements Value {
  type = ValueType.CUSTOM;
  selectedIndex: Value;
  selectedKeys: Value[] = [];
  selectedRules: Value[];
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(index: Value): Result {
    this.selectedIndex = index;
    return OK(this);
  }
  selectKey(key: Value): Result {
    this.selectedKeys.push(key);
    return OK(this);
  }
  selectRules(rules: []): Result {
    this.selectedRules = rules;
    return OK(this);
  }
}

describe("IndexedSelector", () => {
  specify("literal index", () => {
    const index = new StringValue("index");
    const selector = new IndexedSelector(index);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(value));
    expect(value.selectedIndex).to.eql(index);
  });
  describe("exceptions", () => {
    specify("invalid index", () => {
      expect(() => new IndexedSelector(NIL)).to.throw("invalid index");
    });
  });
});

describe("KeyedSelector", () => {
  specify("one key", () => {
    const keys = [new StringValue("key")];
    const selector = new KeyedSelector(keys);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(value));
    expect(value.selectedKeys).to.eql(keys);
  });
  specify("multiple keys", () => {
    const keys = [new StringValue("key1"), new StringValue("key2")];
    const selector = new KeyedSelector(keys);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(value));
    expect(value.selectedKeys).to.eql(keys);
  });
  describe("exceptions", () => {
    specify("empty key list", () => {
      expect(() => new KeyedSelector([])).to.throws("empty selector");
    });
  });
});

describe("GenericSelector", () => {
  specify("string rule", () => {
    const rules = [new StringValue("rule")];
    const selector = new GenericSelector(rules);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(value));
    expect(value.selectedRules).to.eql(rules);
  });
  specify("tuple rule", () => {
    const rules = [
      new TupleValue([new StringValue("rule"), new IntegerValue(1)]),
    ];
    const selector = new GenericSelector(rules);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(value));
    expect(value.selectedRules).to.eql(rules);
  });
  specify("multiple rules", () => {
    const rules = [
      new StringValue("rule1"),
      new TupleValue([new StringValue("rule2")]),
    ];
    const selector = new GenericSelector(rules);
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(value));
    expect(value.selectedRules).to.eql(rules);
  });
  describe("exceptions", () => {
    specify("empty rules", () => {
      expect(() => new GenericSelector([])).to.throws("empty selector");
    });
  });
});

specify("custom selectors", () => {
  class CustomSelector implements Selector {
    name: string;
    constructor(name: string) {
      this.name = name;
    }
    apply(value: Value): Result {
      return OK(new TupleValue([new StringValue(this.name), value]));
    }
  }

  const selector = new CustomSelector("custom");
  const value = new MockValue();
  expect(selector.apply(value)).to.eql(
    OK(new TupleValue([new StringValue("custom"), value]))
  );
});
