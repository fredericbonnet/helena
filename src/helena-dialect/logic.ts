/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, Command, ResultCode } from "../core/command";
import {
  BooleanValue,
  FALSE,
  ScriptValue,
  TRUE,
  Value,
  ValueType,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope } from "./core";

export const trueCmd = (): Command => ({
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(TRUE);
    throw new Error("TODO implement infix operators"); // TODO
  },
});
export const falseCmd = (): Command => ({
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(FALSE);
    throw new Error("TODO implement infix operators"); // TODO
  },
});

export const notCmd = (scope: Scope): Command => ({
  execute(args: Value[]): Result {
    if (args.length != 2) return ARITY_ERROR("! arg");
    const result = executeCondition(scope, args[1]);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
});
const andCmd = (scope: Scope): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("&& arg ?arg ...?");
    let r = true;
    for (let i = 1; i < args.length; i++) {
      const result = executeCondition(scope, args[i]);
      if (result.code != ResultCode.OK) return result;
      if (!(result.value as BooleanValue).value) {
        r = false;
        break;
      }
    }

    return r ? OK(TRUE) : OK(FALSE);
  },
});
const orCmd = (scope: Scope): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("|| arg ?arg ...?");
    let r = false;
    for (let i = 1; i < args.length; i++) {
      const result = executeCondition(scope, args[i]);
      if (result.code != ResultCode.OK) return result;
      if ((result.value as BooleanValue).value) {
        r = true;
        break;
      }
    }

    return r ? OK(TRUE) : OK(FALSE);
  },
});

function executeCondition(scope: Scope, value: Value): Result {
  if (value.type == ValueType.SCRIPT) {
    const result = scope.executeScript(value as ScriptValue);
    if (result.code != ResultCode.OK) return result;
    return OK(BooleanValue.fromValue(result.value));
  } else {
    return OK(BooleanValue.fromValue(value));
  }
}

export function registerLogicCommands(scope: Scope) {
  scope.registerCommand("true", trueCmd);
  scope.registerCommand("false", falseCmd);

  scope.registerCommand("!", notCmd);
  scope.registerCommand("&&", andCmd);
  scope.registerCommand("||", orCmd);
}
