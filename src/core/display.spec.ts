import { expect } from "chai";
import {
  displayLiteralOrBlock,
  displayLiteralOrString,
  displayList,
  undisplayableValue,
} from "./display";
import { Script } from "./syntax";
import { FALSE, INT, NUM, ScriptValue, STR, TRUE } from "./values";

describe("display", () => {
  describe("undisplayableValue", () => {
    it("should generate a placeholder block with a comment", () => {
      expect(undisplayableValue()).to.eql("{#{undisplayable value}#}");
    });
    it("should accept a custom comment", () => {
      expect(undisplayableValue("some value")).to.eql("{#{some value}#}");
    });
  });
  describe("displayLiteralOrString", () => {
    it("should generate an empty quoted string for an empty string", () => {
      expect(displayLiteralOrString("")).to.eql('""');
    });
    it("should generate a literal for a string with no special character", () => {
      expect(displayLiteralOrString("name")).to.eql("name");
      expect(displayLiteralOrString("nameWithUnicode\u1234")).to.eql(
        "nameWithUnicode\u1234"
      );
    });
    it("should generate a quoted string for strings with special characters", () => {
      expect(displayLiteralOrString("some value")).to.eql('"some value"');
      expect(displayLiteralOrString("$value")).to.eql('"\\$value"');
      expect(displayLiteralOrString('\\#{[()]}#"')).to.eql(
        '"\\\\#\\{\\[\\()]}#\\""'
      );
    });
  });
  describe("displayLiteralOrBlock", () => {
    it("should generate an empty block for an empty string", () => {
      expect(displayLiteralOrBlock("")).to.eql("{}");
    });
    it("should generate a literal for a string with no special character", () => {
      expect(displayLiteralOrBlock("name")).to.eql("name");
      expect(displayLiteralOrBlock("nameWithUnicode\u1234")).to.eql(
        "nameWithUnicode\u1234"
      );
    });
    it("should generate a quoted string for strings with special characters", () => {
      expect(displayLiteralOrBlock("some value")).to.eql("{some value}");
      expect(displayLiteralOrBlock("$value")).to.eql("{\\$value}");
      expect(displayLiteralOrBlock('{\\#{[()]}#"}')).to.eql(
        '{\\{\\\\\\#\\{\\[\\(\\)\\]\\}\\#\\"\\}}'
      );
    });
  });
  describe("displayList", () => {
    it("should generate a whitespace-separated list of values", () => {
      const values = [STR("literal"), STR("some string"), INT(123), NUM(1.23)];
      expect(displayList(values)).to.eql('literal "some string" 123 1.23');
    });
    it("should replace non-displayable values with placeholder", () => {
      const values = [TRUE, new ScriptValue(new Script(), undefined), FALSE];
      expect(displayList(values)).to.eql(
        "true {#{undisplayable value}#} false"
      );
    });
    it("should accept custom display function for non-displayable values", () => {
      const values = [TRUE, new ScriptValue(new Script(), undefined), FALSE];
      expect(displayList(values, () => undisplayableValue("foo"))).to.eql(
        "true {#{foo}#} false"
      );
    });
  });
});
