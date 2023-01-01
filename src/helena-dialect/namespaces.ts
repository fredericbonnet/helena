/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ERROR, ResultCode, YIELD } from "../core/results";
import { Command } from "../core/command";
import { Value, ScriptValue, ValueType, TupleValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, DeferredValue, Process, Scope } from "./core";

class NamespaceValue extends CommandValue {
  readonly scope: Scope;
  readonly namespace: Command;
  constructor(command: Command, scope: Scope) {
    super(command);
    this.scope = scope;
    this.namespace = new NamespaceCommand(this);
  }

  selectKey(key: Value): Result {
    return this.scope.getVariable(key.asString());
  }
}
export class NamespaceValueCommand implements Command {
  readonly value: NamespaceValue;
  constructor(scope: Scope) {
    this.value = new NamespaceValue(this, scope);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("namespace eval body");
        return YIELD(new DeferredValue(args[2], this.value.scope));
      }
      case "call": {
        if (args.length < 3)
          return ARITY_ERROR("namespace call cmdname ?arg ...?");
        const command = args[2];
        if (!this.value.scope.hasLocalCommand(command.asString()))
          return ERROR(`invalid command name "${command.asString()}"`);
        const cmdline = args.slice(2);
        return YIELD(
          new DeferredValue(new TupleValue(cmdline), this.value.scope)
        );
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
      const command = new NamespaceValueCommand(state.subscope);
      if (state.name) {
        state.scope.registerCommand(
          state.name.asString(),
          command.value.namespace
        );
      }
      return OK(
        result.code == ResultCode.RETURN ? result.value : command.value
      );
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.BREAK:
      return ERROR("unexpected break");
    case ResultCode.CONTINUE:
      return ERROR("unexpected continue");
    default:
      return result;
  }
};
