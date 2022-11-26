import { expect } from "chai";
import { ERROR, OK } from "./results";
import { GenericSelector, IndexedSelector, KeyedSelector } from "./selectors";
import { Script } from "./syntax";
import {
  NIL,
  IntegerValue,
  StringValue,
  ListValue,
  MapValue,
  TupleValue,
  ScriptValue,
  QualifiedValue,
  NumberValue,
  BooleanValue,
  FALSE,
  TRUE,
  ValueType,
} from "./values";

describe("values", () => {
  describe("NIL", () => {
    specify("type should be NIL", () => {
      expect(NIL.type).to.eql(ValueType.NIL);
    });
    it("should have no string representation", () => {
      expect(() => NIL.asString()).to.throw("nil has no string representation");
    });
    it("should not be index-selectable", () => {
      expect(NIL).to.not.have.property("selectIndex");
    });
    it("should not be key-selectable", () => {
      expect(NIL).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      expect(NIL).to.not.have.property("select");
      expect(NIL).to.not.have.property("selectRules");
    });
  });

  describe("BooleanValue", () => {
    specify("type should be BOOLEAN", () => {
      expect(TRUE.type).to.eql(ValueType.BOOLEAN);
      expect(FALSE.type).to.eql(ValueType.BOOLEAN);
    });
    specify("string representation should be true or false", () => {
      expect(TRUE.asString()).to.eql("true");
      expect(FALSE.asString()).to.eql("false");
      expect(new BooleanValue(true).asString()).to.eql("true");
      expect(new BooleanValue(false).asString()).to.eql("false");
    });
    describe("fromValue()", () => {
      it("should return the passed BooleanValue", () => {
        expect(BooleanValue.fromValue(TRUE).value).to.equal(TRUE);
        expect(BooleanValue.fromValue(FALSE).value).to.equal(FALSE);
      });
      it("should accept boolean strings", () => {
        expect(BooleanValue.fromValue(new StringValue("false")).value).to.equal(
          FALSE
        );
        expect(BooleanValue.fromValue(new StringValue("true")).value).to.equal(
          TRUE
        );
      });
      it("should reject non-boolean strings", () => {
        expect(BooleanValue.fromValue(new IntegerValue(0))).to.eql(
          ERROR('invalid boolean "0"')
        );
        expect(BooleanValue.fromValue(new StringValue("1"))).to.eql(
          ERROR('invalid boolean "1"')
        );
        expect(BooleanValue.fromValue(new StringValue("no"))).to.eql(
          ERROR('invalid boolean "no"')
        );
        expect(BooleanValue.fromValue(new StringValue("yes"))).to.eql(
          ERROR('invalid boolean "yes"')
        );
        expect(BooleanValue.fromValue(new StringValue("a"))).to.eql(
          ERROR('invalid boolean "a"')
        );
      });
    });
    it("should not be index-selectable", () => {
      expect(TRUE).to.not.have.property("selectIndex");
      expect(FALSE).to.not.have.property("selectIndex");
    });
    it("should not be key-selectable", () => {
      expect(TRUE).to.not.have.property("selectKey");
      expect(FALSE).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      expect(TRUE).to.not.have.property("select");
      expect(TRUE).to.not.have.property("selectRules");
      expect(FALSE).to.not.have.property("select");
      expect(FALSE).to.not.have.property("selectRules");
    });
  });

  describe("IntegerValue", () => {
    specify("type should be INTEGER", () => {
      const value = new IntegerValue(123);
      expect(value.type).to.eql(ValueType.INTEGER);
    });
    specify(
      "string representation should be the decimal representation of its value",
      () => {
        const integer = 0x1234;
        const value = new IntegerValue(integer);
        expect(value.asString()).to.eql("4660");
      }
    );
    describe("fromValue()", () => {
      it("should return the passed IntegerValue", () => {
        const value = new IntegerValue(1234);
        expect(IntegerValue.fromValue(value).value).to.equal(value);
      });
      it("should accept integer strings", () => {
        const value = new StringValue("1234");
        expect(IntegerValue.fromValue(value).data.value).to.eql(1234);
      });
      it("should reject non-integer strings", () => {
        const value = new StringValue("a");
        expect(IntegerValue.fromValue(value)).to.eql(
          ERROR('invalid integer "a"')
        );
      });
    });
    it("should not be index-selectable", () => {
      const value = new IntegerValue(0);
      expect(value).to.not.have.property("selectIndex");
    });
    it("should not be key-selectable", () => {
      const value = new IntegerValue(0);
      expect(value).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      const value = new IntegerValue(0);
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
    });
  });

  describe("NumberValue", () => {
    specify("type should be NUMBER", () => {
      const value = new NumberValue(12.3);
      expect(value.type).to.eql(ValueType.NUMBER);
    });
    specify(
      "string representation should be the decimal representation of its value",
      () => {
        const integer = 123.4;
        const value = new NumberValue(integer);
        expect(value.asString()).to.eql("123.4");
      }
    );
    describe("fromValue()", () => {
      it("should return the passed NumberValue", () => {
        const value = new NumberValue(12.34);
        expect(NumberValue.fromValue(value).value).to.equal(value);
      });
      it("should accept integer values", () => {
        const value = new IntegerValue(4567);
        expect(NumberValue.fromValue(value).data.value).to.eql(4567);
      });
      it("should accept float strings", () => {
        const value = new StringValue("12.34");
        expect(NumberValue.fromValue(value).data.value).to.eql(12.34);
      });
      it("should reject non-number strings", () => {
        const value = new StringValue("a");
        expect(NumberValue.fromValue(value)).to.eql(
          ERROR('invalid number "a"')
        );
      });
    });
    it("should not be index-selectable", () => {
      const value = new NumberValue(0);
      expect(value).to.not.have.property("selectIndex");
    });
    it("should not be key-selectable", () => {
      const value = new NumberValue(0);
      expect(value).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      const value = new NumberValue(0);
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
    });
  });

  describe("StringValue", () => {
    specify("type should be STRING", () => {
      const value = new StringValue("some string");
      expect(value.type).to.eql(ValueType.STRING);
    });
    specify("string representation should be its value", () => {
      const string = "some string";
      const value = new StringValue(string);
      expect(value.asString()).to.eql(string);
    });
    describe("indexed selectors", () => {
      it("should select characters by index", () => {
        const string = "some string";
        const value = new StringValue(string);
        const index = new IntegerValue(2);
        expect(value.selectIndex(index)).to.eql(OK(new StringValue(string[2])));
      });
      it("should accept integer strings", () => {
        const string = "some string";
        const value = new StringValue(string);
        const index = new StringValue("2");
        expect(value.selectIndex(index)).to.eql(OK(new StringValue(string[2])));
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
          expect(value.selectIndex(index)).to.eql(
            ERROR('invalid integer "foo"')
          );
        });
        specify("index out of range", () => {
          const string = "some string";
          const value = new StringValue(string);
          expect(value.selectIndex(new IntegerValue(-1))).to.eql(
            ERROR('index out of range "-1"')
          );
          expect(value.selectIndex(new IntegerValue(string.length))).to.eql(
            ERROR(`index out of range "${string.length}"`)
          );
        });
      });
    });
    it("should not be key-selectable", () => {
      const value = new StringValue("some string");
      expect(value).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      const value = new StringValue("some string");
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
    });
  });

  describe("ListValue", () => {
    specify("type should be LIST", () => {
      const value = new ListValue([]);
      expect(value.type).to.eql(ValueType.LIST);
    });
    it("should have no string representation", () => {
      const value = new ListValue([]);
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    describe("fromValue()", () => {
      it("should return the passed ListValue", () => {
        const value = new ListValue([]);
        expect(ListValue.fromValue(value).value).to.equal(value);
      });
      it("should accept tuples", () => {
        const value = new TupleValue([
          new StringValue("a"),
          TRUE,
          new IntegerValue(10),
        ]);
        expect(ListValue.fromValue(value).value).to.eql(
          new ListValue(value.values)
        );
      });
      it("should reject other value types", () => {
        expect(ListValue.fromValue(TRUE)).to.eql(ERROR("invalid list"));
        expect(ListValue.fromValue(new StringValue("a"))).to.eql(
          ERROR("invalid list")
        );
        expect(ListValue.fromValue(new IntegerValue(10))).to.eql(
          ERROR("invalid list")
        );
        expect(ListValue.fromValue(new NumberValue(10))).to.eql(
          ERROR("invalid list")
        );
        expect(ListValue.fromValue(new ScriptValue(new Script(), ""))).to.eql(
          ERROR("invalid list")
        );
        expect(ListValue.fromValue(new MapValue({}))).to.eql(
          ERROR("invalid list")
        );
      });
    });
    describe("indexed selectors", () => {
      it("should select elements by index", () => {
        const values = [new StringValue("value1"), new StringValue("value2")];
        const value = new ListValue(values);
        const index = new IntegerValue(1);
        expect(value.selectIndex(index)).to.eql(OK(values[1]));
      });
      it("should accept integer strings", () => {
        const values = [new StringValue("value1"), new StringValue("value2")];
        const value = new ListValue(values);
        const index = new StringValue("0");
        expect(value.selectIndex(index)).to.eql(OK(values[0]));
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
          expect(value.selectIndex(index)).to.eql(
            ERROR('invalid integer "foo"')
          );
        });
        specify("index out of range", () => {
          const values = [new StringValue("value1"), new StringValue("value2")];
          const value = new ListValue(values);
          expect(value.selectIndex(new IntegerValue(-1))).to.eql(
            ERROR('index out of range "-1"')
          );
          expect(value.selectIndex(new IntegerValue(values.length))).to.eql(
            ERROR(`index out of range "${values.length}"`)
          );
        });
      });
    });
    it("should not be key-selectable", () => {
      const value = new ListValue([]);
      expect(value).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      const value = new ListValue([]);
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
    });
  });

  describe("MapValue", () => {
    specify("type should be MAP", () => {
      const value = new MapValue({});
      expect(value.type).to.eql(ValueType.MAP);
    });
    it("should have no string representation", () => {
      const value = new MapValue({});
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    it("should not be index-selectable", () => {
      const value = new MapValue({});
      expect(value).to.not.have.property("selectIndex");
    });
    describe("keyed selectors", () => {
      it("should select elements by key", () => {
        const values = {
          key1: new StringValue("value1"),
          key2: new StringValue("value2"),
        };
        const value = new MapValue(values);
        const key = new StringValue("key1");
        expect(value.selectKey(key)).to.eql(OK(values["key1"]));
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
          expect(value.selectKey(index)).to.eql(ERROR("unknown key"));
        });
      });
    });
    it("should not be selectable", () => {
      const value = new MapValue({});
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
    });
  });

  describe("TupleValue", () => {
    specify("type should be TUPLE", () => {
      const value = new TupleValue([]);
      expect(value.type).to.eql(ValueType.TUPLE);
    });
    it("should have no string representation", () => {
      const value = new TupleValue([]);
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    describe("indexed selectors", () => {
      it("should apply to elements", () => {
        const values = [
          new ListValue([new StringValue("value1"), new StringValue("value2")]),
          new StringValue("12345"),
        ];
        const value = new TupleValue(values);
        const index = new IntegerValue(1);
        expect(value.selectIndex(index)).to.eql(
          OK(new TupleValue([new StringValue("value2"), new StringValue("2")]))
        );
      });
      it("should recurse into tuples", () => {
        const values = [
          new ListValue([new StringValue("value1"), new StringValue("value2")]),
          new TupleValue([new StringValue("12345"), new StringValue("678")]),
        ];
        const value = new TupleValue(values);
        const index = new IntegerValue(1);
        expect(value.selectIndex(index)).to.eql(
          OK(
            new TupleValue([
              new StringValue("value2"),
              new TupleValue([new StringValue("2"), new StringValue("7")]),
            ])
          )
        );
      });
    });
    describe("keyed selectors", () => {
      it("should apply to elements", () => {
        const values = [
          new MapValue({
            key1: new StringValue("value1"),
            key2: new StringValue("value2"),
          }),
          new MapValue({
            key2: new StringValue("value3"),
            key3: new StringValue("value4"),
          }),
        ];
        const value = new TupleValue(values);
        const key = new StringValue("key2");
        expect(value.selectKey(key)).to.eql(
          OK(
            new TupleValue([
              new StringValue("value2"),
              new StringValue("value3"),
            ])
          )
        );
      });
      it("should recurse into tuples", () => {
        const values = [
          new MapValue({
            key1: new StringValue("value1"),
            key2: new StringValue("value2"),
          }),
          new TupleValue([
            new MapValue({
              key2: new StringValue("value3"),
              key3: new StringValue("value4"),
            }),
            new MapValue({
              key2: new StringValue("value5"),
              key4: new StringValue("value6"),
            }),
          ]),
        ];
        const value = new TupleValue(values);
        const key = new StringValue("key2");
        expect(value.selectKey(key)).to.eql(
          OK(
            new TupleValue([
              new StringValue("value2"),
              new TupleValue([
                new StringValue("value3"),
                new StringValue("value5"),
              ]),
            ])
          )
        );
      });
    });
    describe("select", () => {
      it("should apply selector to elements", () => {
        const values = [
          new ListValue([new StringValue("value1"), new StringValue("value2")]),
          new StringValue("12345"),
        ];
        const value = new TupleValue(values);
        const index = new IntegerValue(1);
        expect(value.select(new IndexedSelector(index))).to.eql(
          OK(new TupleValue([new StringValue("value2"), new StringValue("2")]))
        );
      });
      it("should recurse into tuples", () => {
        const values = [
          new MapValue({
            key1: new StringValue("value1"),
            key2: new StringValue("value2"),
          }),
          new TupleValue([
            new MapValue({
              key2: new StringValue("value3"),
              key3: new StringValue("value4"),
            }),
            new MapValue({
              key2: new StringValue("value5"),
              key4: new StringValue("value6"),
            }),
          ]),
        ];
        const value = new TupleValue(values);
        const key = new StringValue("key2");
        expect(value.select(new KeyedSelector([key]))).to.eql(
          OK(
            new TupleValue([
              new StringValue("value2"),
              new TupleValue([
                new StringValue("value3"),
                new StringValue("value5"),
              ]),
            ])
          )
        );
      });
    });
  });

  describe("ScriptValue", () => {
    specify("type should be SCRIPT", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value.type).to.eql(ValueType.SCRIPT);
    });
    specify("script representation should be its value", () => {
      const script = "cmd arg1 arg2";
      const value = new ScriptValue(new Script(), script);
      expect(value.asString()).to.eql(script);
    });
    it("should not be index-selectable", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value).to.not.have.property("selectIndex");
    });
    it("should not be key-selectable", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value).to.not.have.property("selectKey");
    });
    it("should not be selectable", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
    });
  });

  describe("QualifiedValue", () => {
    specify("type should be QUALIFIED", () => {
      const value = new QualifiedValue(new StringValue("name"), []);
      expect(value.type).to.eql(ValueType.QUALIFIED);
    });
    it("should have no string representation", () => {
      const value = new QualifiedValue(new StringValue("name"), []);
      expect(() => value.asString()).to.throw(
        "value has no string representation"
      );
    });
    describe("indexed selectors", () => {
      it("should return a new qualified value", () => {
        const value = new QualifiedValue(new StringValue("name"), []);
        expect(value.selectIndex(new StringValue("index"))).to.eql(
          OK(
            new QualifiedValue(new StringValue("name"), [
              new IndexedSelector(new StringValue("index")),
            ])
          )
        );
      });
    });
    describe("keyed selectors", () => {
      it("should return a new qualified value", () => {
        const value = new QualifiedValue(new StringValue("name"), []);
        expect(value.selectKey(new StringValue("key"))).to.eql(
          OK(
            new QualifiedValue(new StringValue("name"), [
              new KeyedSelector([new StringValue("key")]),
            ])
          )
        );
      });
      it("should aggregate keys", () => {
        const value = new QualifiedValue(new StringValue("name"), [
          new KeyedSelector([new StringValue("key1"), new StringValue("key2")]),
          new IndexedSelector(new StringValue("index")),
          new KeyedSelector([new StringValue("key3"), new StringValue("key4")]),
        ]);
        expect(value.selectKey(new StringValue("key5"))).to.eql(
          OK(
            new QualifiedValue(new StringValue("name"), [
              new KeyedSelector([
                new StringValue("key1"),
                new StringValue("key2"),
              ]),
              new IndexedSelector(new StringValue("index")),
              new KeyedSelector([
                new StringValue("key3"),
                new StringValue("key4"),
                new StringValue("key5"),
              ]),
            ])
          )
        );
      });
    });
    describe("generic selectors", () => {
      it("should return a new qualified value", () => {
        const value = new QualifiedValue(new StringValue("name"), []);
        expect(value.selectRules([new StringValue("rule")])).to.eql(
          OK(
            new QualifiedValue(new StringValue("name"), [
              new GenericSelector([new StringValue("rule")]),
            ])
          )
        );
      });
    });
    describe("select", () => {
      it("should return a new qualified value", () => {
        const value = new QualifiedValue(new StringValue("name"), []);
        const selector = {
          apply() {
            return OK(new StringValue("value"));
          },
        };
        expect(value.select(selector)).to.eql(
          OK(new QualifiedValue(new StringValue("name"), [selector]))
        );
      });
    });
  });
});
