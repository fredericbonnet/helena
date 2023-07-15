/* eslint-disable jsdoc/require-jsdoc */ // TODO
import * as mochadoc from "../../mochadoc";
import { Documentation } from "../../mochadoc/types";
import {
  defaultDisplayFunction,
  display,
  undisplayableValue,
} from "../core/display";
import { Result, ResultCode } from "../core/results";
import { ListValue, MapValue, Value } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { displayMapValue } from "./dicts";
import { displayListValue } from "./lists";

export const codeBlock = (source: string): string =>
  "```lna\n" + source + "\n```";

const displayer = (displayable) => {
  if (displayable instanceof ListValue) return displayListValue(displayable);
  if (displayable instanceof MapValue) return displayMapValue(displayable);
  if (displayable instanceof ArgspecValue)
    return undisplayableValue(`argspec: "${displayable.usage()}"`);
  return defaultDisplayFunction(displayable);
};
const reindent = (s: string) => {
  const trimmed = s.replace(/^\n/, "").replace(/\n\s*$/, "");
  const lines = trimmed.split("\n");
  const indent = lines[0].match(/^(\s*)/)[1];
  const reindented = lines.map((line) => line.substring(indent.length));
  return reindented.join("\n");
};

export type ExampleSpec = {
  doc?: Documentation;
  script: string;
  result?: Value | Result;
};

const exampleCode = (spec: ExampleSpec) => {
  const script = reindent(spec.script);
  if (!spec.result) return script;

  if ("code" in spec.result) {
    switch (spec.result.code) {
      case ResultCode.ERROR:
        return script + "\n# => [error " + display(spec.result.value) + "]";
      default:
        return script + "\n# => " + display(spec.result.value, displayer);
    }
  }
  return script + "\n# => " + display(spec.result, displayer);
};
export const specifyExample =
  (evaluator: (spec: ExampleSpec) => void) =>
  (title: string, specs: ExampleSpec | ExampleSpec[]) => {
    specify(title, function () {
      mochadoc.testContent(this, evaluator);
      (specs instanceof Array ? specs : [specs]).forEach((spec) => {
        if (spec.doc) mochadoc.testContent(this, spec.doc);
        mochadoc.testContent(this, codeBlock(exampleCode(spec)));
        evaluator(spec);
      });
    });
  };
