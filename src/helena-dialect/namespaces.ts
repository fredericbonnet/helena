/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  YIELD,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, ValueType, TupleValue, NIL } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import {
  CommandValue,
  commandValueType,
  DeferredValue,
  Process,
  Scope,
} from "./core";

class NamespaceValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly namespace: Command;
  constructor(scope: Scope) {
    this.command = this;
    this.scope = scope;
    this.namespace = new NamespaceCommand(this);
  }

  selectKey(key: Value): Result {
    return this.scope.getVariable(key.asString());
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this);
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("namespace eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      }
      case "call": {
        if (args.length < 3)
          return ARITY_ERROR("namespace call cmdname ?arg ...?");
        const command = args[2];
        if (!command.asString)
          return ERROR("command name has no string representation");
        if (!this.scope.hasLocalCommand(command.asString()))
          return ERROR(`invalid command name "${command.asString()}"`);
        const cmdline = args.slice(2);
        return YIELD(new DeferredValue(new TupleValue(cmdline), this.scope));
      }
      case "import": {
        if (args.length != 3) return ARITY_ERROR("namespace import name");
        if (!args[2].asString)
          return ERROR("import name has no string representation");
        const name = args[2].asString();
        const command = this.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve imported command "${name}"`);
        scope.registerNamedCommand(name, command);
        return OK(NIL);
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}

class NamespaceCommand implements Command {
  readonly value: NamespaceValue;
  constructor(value: NamespaceValue) {
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    const command = args[1];
    if (!this.value.scope.hasLocalCommand(command.asString()))
      return ERROR(`invalid command name "${command.asString()}"`);
    const cmdline = args.slice(1);
    return YIELD(new DeferredValue(new TupleValue(cmdline), this.value.scope));
  }
}

type NamespaceBodyState = {
  scope: Scope;
  subscope: Scope;
  process: Process;
  name?: Value;
};
export const namespaceCmd: Command = {
  execute: (args, scope: Scope) => {
    let name, body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      case 3:
        [, name, body] = args;
        break;
      default:
        return ARITY_ERROR("namespace ?name? body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const subscope = new Scope(scope);
    const process = subscope.prepareScriptValue(body as ScriptValue);
    return executeNamespaceBody({ scope, subscope, process, name });
  },
  resume(result: Result): Result {
    const state = result.data as NamespaceBodyState;
    state.process.yieldBack(result.value);
    return executeNamespaceBody(state);
  },
};
const executeNamespaceBody = (state: NamespaceBodyState): Result => {
  const result = state.process.run();
  switch (result.code) {
    case ResultCode.OK:
    case ResultCode.RETURN: {
      const value = new NamespaceValue(state.subscope);
      if (state.name) {
        const result = state.scope.registerCommand(state.name, value.namespace);
        if (result.code != ResultCode.OK) return result;
      }
      return OK(result.code == ResultCode.RETURN ? result.value : value);
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
