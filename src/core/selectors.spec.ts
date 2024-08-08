import { expect } from "chai";
import { ERROR, OK, Result } from "./results";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";
import { NIL, Value, INT, STR, TUPLE, CustomValue, ValueType } from "./values";

class MockValue implements CustomValue {
  readonly type = ValueType.CUSTOM;
  readonly customType = { name: "mock" };
  selectedIndex: Value;
  selectedKeys: Value[] = [];
  selectedRules: Value[];
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

class UnselectableValue implements CustomValue {
  readonly type = ValueType.CUSTOM;
  readonly customType = { name: "unselectable" };
}

describe("selectors", () => {
  describe("IndexedSelector", () => {
    specify("literal index", () => {
      const index = STR("index");
      const selector = new IndexedSelector(index);
      const value = new MockValue();
      expect(selector.apply(value)).to.eql(OK(value));
      expect(value.selectedIndex).to.eql(index);
    });
    describe("display", () => {
      specify("simple index", () => {
        const index = STR("index");
        const selector = new IndexedSelector(index);
        expect(selector.display()).to.eql("[index]");
      });
      specify("index with special characters", () => {
        const index = STR(
          'index with spaces and \\"$[${$( $special characters'
        );
        const selector = new IndexedSelector(index);
        expect(selector.display()).to.eql(
          '["index with spaces and \\\\\\"\\$\\[\\$\\{\\$\\( \\$special characters"]'
        );
      });
    });
    describe("exceptions", () => {
      specify("invalid index", () => {
        expect(() => new IndexedSelector(NIL)).to.throw("invalid index");
        expect(IndexedSelector.create(NIL)).to.eql([ERROR("invalid index")]);
      });
      specify("non-selectable value", () => {
        const selector = new IndexedSelector(INT(1));
        const value = new UnselectableValue();
        expect(selector.apply(value)).to.eql(
          ERROR("value is not index-selectable")
        );
      });
    });
  });

  describe("KeyedSelector", () => {
    specify("one key", () => {
      const keys = [STR("key")];
      const selector = new KeyedSelector(keys);
      const value = new MockValue();
      expect(selector.apply(value)).to.eql(OK(value));
      expect(value.selectedKeys).to.eql(keys);
    });
    specify("multiple keys", () => {
      const keys = [STR("key1"), STR("key2")];
      const selector = new KeyedSelector(keys);
      const value = new MockValue();
      expect(selector.apply(value)).to.eql(OK(value));
      expect(value.selectedKeys).to.eql(keys);
    });
    describe("display", () => {
      specify("simple key", () => {
        const keys = [STR("key")];
        const selector = new KeyedSelector(keys);
        expect(selector.display()).to.eql("(key)");
      });
      specify("multiple keys", () => {
        const keys = [STR("key1"), STR("key2")];
        const selector = new KeyedSelector(keys);
        expect(selector.display()).to.eql("(key1 key2)");
      });
      specify("key with special characters", () => {
        const keys = [STR('key with spaces and \\"$[${$( $special characters')];
        const selector = new KeyedSelector(keys);
        expect(selector.display()).to.eql(
          '("key with spaces and \\\\\\"\\$\\[\\$\\{\\$\\( \\$special characters")'
        );
      });
    });
    describe("exceptions", () => {
      specify("empty key list", () => {
        expect(() => new KeyedSelector([])).to.throws("empty selector");
        expect(KeyedSelector.create([])).to.eql([ERROR("empty selector")]);
      });
      specify("non-selectable value", () => {
        const selector = new KeyedSelector([INT(1)]);
        const value = new UnselectableValue();
        expect(selector.apply(value)).to.eql(
          ERROR("value is not key-selectable")
        );
      });
    });
  });

  describe("GenericSelector", () => {
    specify("string rule", () => {
      const rules = [STR("rule")];
      const selector = new GenericSelector(rules);
      const value = new MockValue();
      expect(selector.apply(value)).to.eql(OK(value));
      expect(value.selectedRules).to.eql(rules);
    });
    specify("tuple rule", () => {
      const rules = [TUPLE([STR("rule"), INT(1)])];
      const selector = new GenericSelector(rules);
      const value = new MockValue();
      expect(selector.apply(value)).to.eql(OK(value));
      expect(value.selectedRules).to.eql(rules);
    });
    specify("multiple rules", () => {
      const rules = [STR("rule1"), TUPLE([STR("rule2")])];
      const selector = new GenericSelector(rules);
      const value = new MockValue();
      expect(selector.apply(value)).to.eql(OK(value));
      expect(value.selectedRules).to.eql(rules);
    });
    describe("display", () => {
      specify("string rule", () => {
        const rules = [STR("rule")];
        const selector = new GenericSelector(rules);
        expect(selector.display()).to.eql("{rule}");
      });
      specify("tuple rule", () => {
        const rules = [TUPLE([STR("rule"), INT(1)])];
        const selector = new GenericSelector(rules);
        expect(selector.display()).to.eql("{rule 1}");
      });
      specify("multiple keys", () => {
        const rules = [
          TUPLE([
            STR("rule1"),
            STR('arg1 with spaces and \\"$[${$( $special ; characters'),
          ]),
          STR("rule2 with spaces"),
          TUPLE([STR("rule3")]),
        ];
        const selector = new GenericSelector(rules);
        expect(selector.display()).to.eql(
          '{rule1 "arg1 with spaces and \\\\\\"\\$\\[\\$\\{\\$\\( \\$special ; characters"; "rule2 with spaces"; rule3}'
        );
      });
    });
    describe("exceptions", () => {
      specify("empty rules", () => {
        expect(() => new GenericSelector([])).to.throws("empty selector");
        expect(GenericSelector.create([])).to.eql([ERROR("empty selector")]);
      });
      specify("non-selectable value", () => {
        const selector = new GenericSelector([STR("rule")]);
        const value = new UnselectableValue();
        expect(selector.apply(value)).to.eql(ERROR("value is not selectable"));
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
        return OK(TUPLE([STR(this.name), value]));
      }
    }

    const selector = new CustomSelector("custom");
    const value = new MockValue();
    expect(selector.apply(value)).to.eql(OK(TUPLE([STR("custom"), value])));
  });
});
