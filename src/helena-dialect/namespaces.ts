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
import {
  Value,
  ScriptValue,
  ValueType,
  NIL,
  LIST,
  STR,
  TUPLE,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import {
  CommandValue,
  commandValueType,
  DeferredValue,
  Process,
  Scope,
} from "./core";
import { Subcommands } from "./subcommands";

class NamespaceMetacommand implements CommandValue, Command {
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
    return NamespaceMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<namespace> subcommands");
        return OK(NamespaceMetacommand.subcommands.list);
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
        return YIELD(new DeferredValue(TUPLE(cmdline), this.scope));
      },
      import: () => {
        if (args.length != 3 && args.length != 4)
          return ARITY_ERROR("<namespace> import name ?alias?");
        const name = args[2].asString?.();
        if (!name) return ERROR("invalid import name");
        const alias = args.length == 4 ? args[3].asString?.() : name;
        if (!alias) return ERROR("invalid alias name");
        const command = this.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve imported command "${name}"`);
        scope.registerNamedCommand(alias, command);
        return OK(NIL);
      },
    });
  }
}

const NAMESPACE_COMMAND_PREFIX = (name) => name.asString?.() ?? "<namespace>";
class NamespaceCommand implements Command {
  readonly metacommand: NamespaceMetacommand;
  constructor(metacommand: NamespaceMetacommand) {
    this.metacommand = metacommand;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.metacommand);
    const subcommand = args[1].asString?.();
    if (subcommand == null) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length != 2) {
        return ARITY_ERROR(NAMESPACE_COMMAND_PREFIX(args[0]) + " subcommands");
      }
      return OK(
        LIST([
          args[1],
          ...this.metacommand.scope.getLocalCommands().map((name) => STR(name)),
        ])
      );
    }
    if (!this.metacommand.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const cmdline = args.slice(1);
    return YIELD(new DeferredValue(TUPLE(cmdline), this.metacommand.scope));
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip ? "" : NAMESPACE_COMMAND_PREFIX(args[0]);
    const signature = [prefix, usage].filter(Boolean).join(" ");
    if (args.length <= 1) {
      return OK(STR(signature + " ?subcommand? ?arg ...?"));
    }
    const subcommand = args[1].asString?.();
    if (subcommand == null) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length > 2) {
        return ARITY_ERROR(signature + " subcommands");
      }
      return OK(STR(signature + " subcommands"));
    }
    if (!this.metacommand.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const command = this.metacommand.scope.resolveNamedCommand(subcommand);
    if (!command.help) return ERROR(`no help for subcommand "${subcommand}"`);
    return command.help(args.slice(1), {
      prefix: signature + " " + subcommand,
      skip: 1,
    });
  }
}

const NAMESPACE_SIGNATURE = "namespace ?name? body";
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
        return ARITY_ERROR(NAMESPACE_SIGNATURE);
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
  help(args) {
    if (args.length > 3) return ARITY_ERROR(NAMESPACE_SIGNATURE);
    return OK(STR(NAMESPACE_SIGNATURE));
  },
};
const executeNamespaceBody = (state: NamespaceBodyState): Result => {
  const result = state.process.run();
  switch (result.code) {
    case ResultCode.OK:
    case ResultCode.RETURN: {
      const metacommand = new NamespaceMetacommand(state.subscope);
      if (state.name) {
        const result = state.scope.registerCommand(
          state.name,
          metacommand.namespace
        );
        if (result.code != ResultCode.OK) return result;
      }
      return OK(result.code == ResultCode.RETURN ? result.value : metacommand);
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
