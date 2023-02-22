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
import { Subcommands } from "./subcommands";

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
    return this.scope.getVariable(key);
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "eval",
    "call",
    "import",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this);
    return NamespaceValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<namespace> subcommands");
        return OK(NamespaceValue.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<namespace> eval body");
        return YIELD(new DeferredValue(args[2], this.scope));
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<namespace> call cmdname ?arg ...?");
        const command = args[2].asString?.();
        if (command == null) return ERROR("invalid command name");
        if (!this.scope.hasLocalCommand(command))
          return ERROR(`unknown command "${command}"`);
        const cmdline = args.slice(2);
        return YIELD(new DeferredValue(new TupleValue(cmdline), this.scope));
      },
      import: () => {
        if (args.length != 3) return ARITY_ERROR("<namespace> import name");
        const name = args[2].asString?.();
        if (!name) return ERROR("invalid import name");
        const command = this.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve imported command "${name}"`);
        scope.registerNamedCommand(name, command);
        return OK(NIL);
      },
    });
  }
}

class NamespaceCommand implements Command {
  readonly value: NamespaceValue;
  constructor(value: NamespaceValue) {
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    const command = args[1].asString?.();
    if (command == null) return ERROR("invalid command name");
    if (!this.value.scope.hasLocalCommand(command))
      return ERROR(`unknown command "${command}"`);
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
