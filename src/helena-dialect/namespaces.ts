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
  StringValue,
  CommandValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { DeferredValue, Process, Scope } from "./core";
import { Subcommands } from "./subcommands";

class NamespaceMetacommand implements Command {
  readonly value: Value;
  readonly namespace: NamespaceCommand;
  constructor(namespace: NamespaceCommand) {
    this.value = new CommandValue(this);
    this.value.selectKey = (key: Value) => this.selectKey(key);
    this.namespace = namespace;
  }

  selectKey(key: Value): Result {
    return this.namespace.scope.getVariable(key);
  }

  static readonly subcommands = new Subcommands([
    "subcommands",
    "eval",
    "call",
    "import",
  ]);
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    return NamespaceMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<namespace> subcommands");
        return OK(NamespaceMetacommand.subcommands.list);
      },
      eval: () => {
        if (args.length != 3) return ARITY_ERROR("<namespace> eval body");
        return DeferredValue.create(
          ResultCode.YIELD,
          args[2],
          this.namespace.scope
        );
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<namespace> call cmdname ?arg ...?");
        const { data: subcommand, code } = StringValue.toString(args[2]);
        if (code != ResultCode.OK) return ERROR("invalid command name");
        if (!this.namespace.scope.hasLocalCommand(subcommand))
          return ERROR(`unknown command "${subcommand}"`);
        const command = this.namespace.scope.resolveNamedCommand(subcommand);
        const cmdline = [new CommandValue(command), ...args.slice(3)];
        return DeferredValue.create(
          ResultCode.YIELD,
          TUPLE(cmdline),
          this.namespace.scope
        );
      },
      import: () => {
        if (args.length != 3 && args.length != 4)
          return ARITY_ERROR("<namespace> import name ?alias?");
        const { data: name, code } = StringValue.toString(args[2]);
        if (code != ResultCode.OK) return ERROR("invalid import name");
        let alias: string;
        if (args.length == 4) {
          const result = StringValue.toString(args[3]);
          if (result.code != ResultCode.OK) return ERROR("invalid alias name");
          alias = result.data;
        } else {
          alias = name;
        }
        const command = this.namespace.scope.resolveNamedCommand(name);
        if (!command) return ERROR(`cannot resolve imported command "${name}"`);
        scope.registerNamedCommand(alias, command);
        return OK(NIL);
      },
    });
  }
}

const NAMESPACE_COMMAND_PREFIX = (name) =>
  StringValue.toString(name, "<namespace>").data;
class NamespaceCommand implements Command {
  readonly metacommand: NamespaceMetacommand;
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.scope = scope;
    this.metacommand = new NamespaceMetacommand(this);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.metacommand.value);
    const { data: subcommand, code } = StringValue.toString(args[1]);
    if (code != ResultCode.OK) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length != 2) {
        return ARITY_ERROR(NAMESPACE_COMMAND_PREFIX(args[0]) + " subcommands");
      }
      return OK(
        LIST([
          args[1],
          ...this.scope.getLocalCommands().map((name) => STR(name)),
        ])
      );
    }
    if (!this.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const command = this.scope.resolveNamedCommand(subcommand);
    const cmdline = [new CommandValue(command), ...args.slice(2)];
    return DeferredValue.create(ResultCode.YIELD, TUPLE(cmdline), this.scope);
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip ? "" : NAMESPACE_COMMAND_PREFIX(args[0]);
    const signature = [prefix, usage].filter(Boolean).join(" ");
    if (args.length <= 1) {
      return OK(STR(signature + " ?subcommand? ?arg ...?"));
    }
    const { data: subcommand, code } = StringValue.toString(args[1]);
    if (code != ResultCode.OK) return ERROR("invalid subcommand name");
    if (subcommand == "subcommands") {
      if (args.length > 2) {
        return ARITY_ERROR(signature + " subcommands");
      }
      return OK(STR(signature + " subcommands"));
    }
    if (!this.scope.hasLocalCommand(subcommand))
      return ERROR(`unknown subcommand "${subcommand}"`);
    const command = this.scope.resolveNamedCommand(subcommand);
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
      const namespace = new NamespaceCommand(state.subscope);
      if (state.name) {
        const result = state.scope.registerCommand(state.name, namespace);
        if (result.code != ResultCode.OK) return result;
      }
      return OK(
        result.code == ResultCode.RETURN
          ? result.value
          : namespace.metacommand.value
      );
    }
    case ResultCode.YIELD:
      return YIELD(result.value, state);
    case ResultCode.ERROR:
      return result;
    default:
      return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
  }
};
