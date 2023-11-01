import { expect } from "chai";
import { undisplayableValue } from "./display";
import { ERROR, OK } from "./results";
import {
  GenericSelector,
  IndexedSelector,
  KeyedSelector,
  Selector,
} from "./selectors";
import { Script } from "./syntax";
import {
  NIL,
  IntegerValue,
  StringValue,
  ListValue,
  DictionaryValue,
  TupleValue,
  ScriptValue,
  QualifiedValue,
  RealValue,
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
    it("should be displayed as an empty expression", () => {
      expect(NIL.display()).to.eql("[]");
    });
    it("should not be index-selectable", () => {
      expect(NIL).to.not.have.property("selectIndex");
      expect(new IndexedSelector(new IntegerValue(1)).apply(NIL)).to.eql(
        ERROR("value is not index-selectable")
      );
    });
    it("should not be key-selectable", () => {
      expect(NIL).to.not.have.property("selectKey");
      expect(new KeyedSelector([new StringValue("key")]).apply(NIL)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      expect(NIL).to.not.have.property("select");
      expect(NIL).to.not.have.property("selectRules");
      expect(new GenericSelector([new StringValue("rule")]).apply(NIL)).to.eql(
        ERROR("value is not selectable")
      );
    });
  });

  describe("BooleanValue", () => {
    specify("type should be BOOLEAN", () => {
      expect(TRUE.type).to.eql(ValueType.BOOLEAN);
      expect(FALSE.type).to.eql(ValueType.BOOLEAN);
    });
    it("should be displayed as true or false literals", () => {
      expect(TRUE.display()).to.eql("true");
      expect(FALSE.display()).to.eql("false");
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
        expect(BooleanValue.fromValue(NIL)).to.eql(
          ERROR("value has no string representation")
        );
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
      expect(new IndexedSelector(new IntegerValue(1)).apply(TRUE)).to.eql(
        ERROR("value is not index-selectable")
      );
      expect(new IndexedSelector(new IntegerValue(1)).apply(FALSE)).to.eql(
        ERROR("value is not index-selectable")
      );
    });
    it("should not be key-selectable", () => {
      expect(TRUE).to.not.have.property("selectKey");
      expect(FALSE).to.not.have.property("selectKey");
      expect(new KeyedSelector([new StringValue("key")]).apply(TRUE)).to.eql(
        ERROR("value is not key-selectable")
      );
      expect(new KeyedSelector([new StringValue("key")]).apply(FALSE)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      expect(TRUE).to.not.have.property("select");
      expect(TRUE).to.not.have.property("selectRules");
      expect(FALSE).to.not.have.property("select");
      expect(FALSE).to.not.have.property("selectRules");
      expect(new GenericSelector([new StringValue("rule")]).apply(TRUE)).to.eql(
        ERROR("value is not selectable")
      );
      expect(
        new GenericSelector([new StringValue("rule")]).apply(FALSE)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("IntegerValue", () => {
    specify("type should be INTEGER", () => {
      const value = new IntegerValue(123);
      expect(value.type).to.eql(ValueType.INTEGER);
    });
    it("should be displayed as a literal decimal value", () => {
      const integer = 0x1234;
      const value = new IntegerValue(integer);
      expect(value.display()).to.eql("4660");
    });
    describe("fromValue()", () => {
      it("should return the passed IntegerValue", () => {
        const value = new IntegerValue(1234);
        expect(IntegerValue.fromValue(value).value).to.equal(value);
      });
      it("should accept integer strings", () => {
        const value = new StringValue("1234");
        expect(IntegerValue.fromValue(value).data.value).to.eql(1234);
      });
      it("should accept round reals", () => {
        const value = new RealValue(1);
        expect(IntegerValue.fromValue(value).data.value).to.eql(1);
      });
      it("should reject non-integer strings", () => {
        expect(IntegerValue.fromValue(NIL)).to.eql(
          ERROR("value has no string representation")
        );
        expect(IntegerValue.fromValue(new RealValue(1e100))).to.eql(
          ERROR('invalid integer "1e+100"')
        );
        expect(IntegerValue.fromValue(new RealValue(1.1))).to.eql(
          ERROR('invalid integer "1.1"')
        );
        expect(IntegerValue.fromValue(new StringValue("a"))).to.eql(
          ERROR('invalid integer "a"')
        );
        expect(IntegerValue.fromValue(new StringValue("1.2"))).to.eql(
          ERROR('invalid integer "1.2"')
        );
      });
    });
    it("should not be index-selectable", () => {
      const value = new IntegerValue(0);
      expect(value).to.not.have.property("selectIndex");
      expect(new IndexedSelector(new IntegerValue(1)).apply(value)).to.eql(
        ERROR("value is not index-selectable")
      );
    });
    it("should not be key-selectable", () => {
      const value = new IntegerValue(0);
      expect(value).to.not.have.property("selectKey");
      expect(new KeyedSelector([new StringValue("key")]).apply(value)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      const value = new IntegerValue(0);
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
      expect(
        new GenericSelector([new StringValue("rule")]).apply(value)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("RealValue", () => {
    specify("type should be REAL", () => {
      const value = new RealValue(12.3);
      expect(value.type).to.eql(ValueType.REAL);
    });
    it("should be displayed as a literal decimal value", () => {
      const real = 123.4;
      const value = new RealValue(real);
      expect(value.display()).to.eql("123.4");
    });
    describe("fromValue()", () => {
      it("should return the passed RealValue", () => {
        const value = new RealValue(12.34);
        expect(RealValue.fromValue(value).value).to.equal(value);
      });
      it("should accept integer values", () => {
        const value = new IntegerValue(4567);
        expect(RealValue.fromValue(value).data.value).to.eql(4567);
      });
      it("should accept float strings", () => {
        const value = new StringValue("12.34");
        expect(RealValue.fromValue(value).data.value).to.eql(12.34);
      });
      it("should reject non-number strings", () => {
        expect(RealValue.fromValue(NIL)).to.eql(
          ERROR("value has no string representation")
        );
        expect(RealValue.fromValue(new StringValue("a"))).to.eql(
          ERROR('invalid number "a"')
        );
      });
    });
    it("should not be index-selectable", () => {
      const value = new RealValue(0);
      expect(value).to.not.have.property("selectIndex");
      expect(new IndexedSelector(new IntegerValue(1)).apply(value)).to.eql(
        ERROR("value is not index-selectable")
      );
    });
    it("should not be key-selectable", () => {
      const value = new RealValue(0);
      expect(value).to.not.have.property("selectKey");
      expect(new KeyedSelector([new StringValue("key")]).apply(value)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      const value = new RealValue(0);
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
      expect(
        new GenericSelector([new StringValue("rule")]).apply(value)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("StringValue", () => {
    specify("type should be STRING", () => {
      const value = new StringValue("some string");
      expect(value.type).to.eql(ValueType.STRING);
    });
    describe("should be displayed as a Helena string", () => {
      specify("empty string", () => {
        const string = "";
        const value = new StringValue(string);
        expect(value.display()).to.eql(`""`);
      });
      specify("simple string", () => {
        const string = "some string";
        const value = new StringValue(string);
        expect(value.display()).to.eql(`"some string"`);
      });
      specify("string with special characters", () => {
        const string = 'some \\"$[${$( $string';
        const value = new StringValue(string);
        expect(value.display()).to.eql(
          `"some \\\\\\"\\$\\[\\$\\{\\$\\( \\$string"`
        );
      });
    });
    describe("fromValue()", () => {
      it("should return the passed StringValue", () => {
        const value = new StringValue("some string");
        expect(StringValue.fromValue(value).value).to.equal(value);
      });
      it("should accept booleans as true/false strings", () => {
        expect(StringValue.fromValue(FALSE).data.value).to.equal("false");
        expect(StringValue.fromValue(TRUE).data.value).to.equal("true");
        expect(
          StringValue.fromValue(new BooleanValue(false)).data.value
        ).to.equal("false");
        expect(
          StringValue.fromValue(new BooleanValue(true)).data.value
        ).to.equal("true");
      });
      it("should accept integers as decimal strings", () => {
        const value = new IntegerValue(1234);
        expect(StringValue.fromValue(value).data.value).to.eql("1234");
      });
      it("should accept reals as decimal strings", () => {
        const value = new RealValue(1.1);
        expect(StringValue.fromValue(value).data.value).to.eql("1.1");
      });
      it("should accept scripts with source", () => {
        const value = new ScriptValue(new Script(), "source");
        expect(StringValue.fromValue(value).data.value).to.eql("source");
      });
      it("should reject other value types", () => {
        expect(StringValue.fromValue(NIL)).to.eql(
          ERROR("value has no string representation")
        );
        expect(StringValue.fromValue(new ListValue([]))).to.eql(
          ERROR("value has no string representation")
        );
        expect(StringValue.fromValue(new DictionaryValue({}))).to.eql(
          ERROR("value has no string representation")
        );
        expect(StringValue.fromValue(new TupleValue([]))).to.eql(
          ERROR("value has no string representation")
        );
        expect(StringValue.fromValue(new ScriptValue(new Script()))).to.eql(
          ERROR("value has no string representation")
        );
        expect(
          StringValue.fromValue(new QualifiedValue(new StringValue("name"), []))
        ).to.eql(ERROR("value has no string representation"));
      });
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
          expect(value.selectIndex(NIL)).to.eql(
            ERROR("value has no string representation")
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
      expect(new KeyedSelector([new StringValue("key")]).apply(value)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      const value = new StringValue("some string");
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
      expect(
        new GenericSelector([new StringValue("rule")]).apply(value)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("ListValue", () => {
    specify("type should be LIST", () => {
      const value = new ListValue([]);
      expect(value.type).to.eql(ValueType.LIST);
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
        expect(ListValue.fromValue(new RealValue(10))).to.eql(
          ERROR("invalid list")
        );
        expect(ListValue.fromValue(new ScriptValue(new Script(), ""))).to.eql(
          ERROR("invalid list")
        );
        expect(ListValue.fromValue(new DictionaryValue({}))).to.eql(
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
          expect(value.selectIndex(NIL)).to.eql(
            ERROR("value has no string representation")
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
      expect(new KeyedSelector([new StringValue("key")]).apply(value)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      const value = new ListValue([]);
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
      expect(
        new GenericSelector([new StringValue("rule")]).apply(value)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("DictionaryValue", () => {
    specify("type should be DICTIONARY", () => {
      const value = new DictionaryValue({});
      expect(value.type).to.eql(ValueType.DICTIONARY);
    });
    it("should not be index-selectable", () => {
      const value = new DictionaryValue({});
      expect(value).to.not.have.property("selectIndex");
      expect(new IndexedSelector(new IntegerValue(1)).apply(value)).to.eql(
        ERROR("value is not index-selectable")
      );
    });
    describe("keyed selectors", () => {
      it("should select elements by key", () => {
        const values = {
          key1: new StringValue("value1"),
          key2: new StringValue("value2"),
        };
        const value = new DictionaryValue(values);
        const key = new StringValue("key1");
        expect(value.selectKey(key)).to.eql(OK(values["key1"]));
      });
      describe("exceptions", () => {
        specify("invalid key type", () => {
          const value = new DictionaryValue({});
          expect(value.selectKey(NIL)).to.eql(ERROR("invalid key"));
        });
        specify("unknown key value", () => {
          const value = new DictionaryValue({});
          const key = new StringValue("foo");
          expect(value.selectKey(key)).to.eql(ERROR("unknown key"));
        });
      });
    });
    it("should not be selectable", () => {
      const value = new DictionaryValue({});
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
      expect(
        new GenericSelector([new StringValue("rule")]).apply(value)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("TupleValue", () => {
    specify("type should be TUPLE", () => {
      const value = new TupleValue([]);
      expect(value.type).to.eql(ValueType.TUPLE);
    });
    describe("should be displayed as a Helena tuple", () => {
      specify("empty tuple", () => {
        const value = new TupleValue([]);
        expect(value.display()).to.eql(`()`);
      });
      specify("simple tuple", () => {
        const value = new TupleValue([
          new StringValue("some string"),
          NIL,
          new IntegerValue(1),
        ]);
        expect(value.display()).to.eql(`("some string" [] 1)`);
      });
      specify("undisplayable elements", () => {
        const value = new TupleValue([
          new ListValue([]),
          new DictionaryValue({}),
        ]);
        expect(value.display()).to.eql(
          `({#{undisplayable value}#} {#{undisplayable value}#})`
        );
      });
      specify("custom function", () => {
        const value = new TupleValue([
          new ListValue([]),
          new DictionaryValue({}),
        ]);
        expect(
          value.display((v) => undisplayableValue(v.constructor.name))
        ).to.eql(`({#{ListValue}#} {#{DictionaryValue}#})`);
      });
      specify("recursive tuple", () => {
        const value = new TupleValue([new TupleValue([new TupleValue([])])]);
        expect(value.display()).to.eql(`((()))`);
      });
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
      describe("exceptions", () => {
        specify("non-selectable element", () => {
          const values = [new IntegerValue(0)];
          const value = new TupleValue(values);
          const index = new IntegerValue(0);
          expect(value.selectIndex(index)).to.eql(
            ERROR("value is not index-selectable")
          );
        });
      });
    });
    describe("keyed selectors", () => {
      it("should apply to elements", () => {
        const values = [
          new DictionaryValue({
            key1: new StringValue("value1"),
            key2: new StringValue("value2"),
          }),
          new DictionaryValue({
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
          new DictionaryValue({
            key1: new StringValue("value1"),
            key2: new StringValue("value2"),
          }),
          new TupleValue([
            new DictionaryValue({
              key2: new StringValue("value3"),
              key3: new StringValue("value4"),
            }),
            new DictionaryValue({
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
      describe("exceptions", () => {
        specify("non-selectable element", () => {
          const values = [new IntegerValue(0)];
          const value = new TupleValue(values);
          const key = new StringValue("key2");
          expect(value.selectKey(key)).to.eql(
            ERROR("value is not key-selectable")
          );
        });
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
          new DictionaryValue({
            key1: new StringValue("value1"),
            key2: new StringValue("value2"),
          }),
          new TupleValue([
            new DictionaryValue({
              key2: new StringValue("value3"),
              key3: new StringValue("value4"),
            }),
            new DictionaryValue({
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
      describe("exceptions", () => {
        specify("non-selectable element", () => {
          const values = [new IntegerValue(0)];
          const value = new TupleValue(values);
          const index = new IntegerValue(1);
          expect(value.select(new IndexedSelector(index))).to.eql(
            ERROR("value is not index-selectable")
          );
          const key = new StringValue("key2");
          expect(value.select(new KeyedSelector([key]))).to.eql(
            ERROR("value is not key-selectable")
          );
        });
      });
    });
  });

  describe("ScriptValue", () => {
    specify("type should be SCRIPT", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value.type).to.eql(ValueType.SCRIPT);
    });
    describe("should be displayed as a Helena block", () => {
      specify("empty script", () => {
        const value = new ScriptValue(new Script(), "");
        expect(value.display()).to.eql(`{}`);
      });
      specify("regular script", () => {
        const script = "cmd arg1 arg2";
        const value = new ScriptValue(new Script(), script);
        expect(value.display()).to.eql(`{${script}}`);
      });
      specify("script with no source", () => {
        const value = new ScriptValue(new Script(), undefined);
        expect(value.display()).to.eql(`{#{undisplayable script}#}`);
      });
      specify("custom display function", () => {
        const value = new ScriptValue(new Script(), undefined);
        expect(value.display(() => "{}")).to.eql(`{}`);
      });
    });
    it("should not be index-selectable", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value).to.not.have.property("selectIndex");
      expect(new IndexedSelector(new IntegerValue(1)).apply(value)).to.eql(
        ERROR("value is not index-selectable")
      );
    });
    it("should not be key-selectable", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value).to.not.have.property("selectKey");
      expect(new KeyedSelector([new StringValue("key")]).apply(value)).to.eql(
        ERROR("value is not key-selectable")
      );
    });
    it("should not be selectable", () => {
      const value = new ScriptValue(new Script(), "");
      expect(value).to.not.have.property("select");
      expect(value).to.not.have.property("selectRules");
      expect(
        new GenericSelector([new StringValue("rule")]).apply(value)
      ).to.eql(ERROR("value is not selectable"));
    });
  });

  describe("QualifiedValue", () => {
    specify("type should be QUALIFIED", () => {
      const value = new QualifiedValue(new StringValue("name"), []);
      expect(value.type).to.eql(ValueType.QUALIFIED);
    });
    describe("should be displayed as a Helena qualified word", () => {
      specify("indexed selectors", () => {
        const value = new QualifiedValue(new StringValue("name"), [
          new IndexedSelector(new StringValue("index")),
        ]);

        expect(value.display()).to.eql("name[index]");
      });
      specify("keyed selectors", () => {
        const value = new QualifiedValue(new StringValue("name"), [
          new KeyedSelector([new StringValue("key1"), new StringValue("key2")]),
        ]);

        expect(value.display()).to.eql(`name(key1 key2)`);
      });
      specify("generic selector", () => {
        const value = new QualifiedValue(new StringValue("name"), [
          new GenericSelector([
            new StringValue("rule1"),
            new TupleValue([new StringValue("rule2"), new IntegerValue(123)]),
          ]),
        ]);

        expect(value.display()).to.eql(`name{rule1; rule2 123}`);
      });
      specify("custom selector", () => {
        class UndisplayableSelector implements Selector {
          apply() {
            return ERROR("not implemented");
          }
        }
        class DisplayableSelector implements Selector {
          apply() {
            return ERROR("not implemented");
          }
          display(): string {
            return "{foo bar}";
          }
        }
        const value = new QualifiedValue(new StringValue("name"), [
          new UndisplayableSelector(),
          new DisplayableSelector(),
        ]);

        expect(value.display()).to.eql(
          `name{#{undisplayable value}#}{foo bar}`
        );
        expect(value.display(() => undisplayableValue("baz sprong"))).to.eql(
          `name{#{baz sprong}#}{foo bar}`
        );
      });
      specify("source with special characters", () => {
        const value = new QualifiedValue(
          new StringValue('some # \\"$[${$( $string'),
          [
            new KeyedSelector([
              new StringValue("key1"),
              new StringValue("key2"),
            ]),
          ]
        );

        expect(value.display()).to.eql(
          `{some \\# \\\\\\"\\$\\[\\$\\{\\$\\( \\$string}(key1 key2)`
        );
      });
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
