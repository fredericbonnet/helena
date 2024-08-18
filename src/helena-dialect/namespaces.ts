/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/commands";
import {
  Value,
  ScriptValue,
  ValueType,
  NIL,
  LIST,
  STR,
  StringValue,
  CommandValue,
  TupleValue,
} from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { ContinuationValue, Scope } from "./core";
import {
  INVALID_SUBCOMMAND_ERROR,
  Subcommands,
  UNKNOWN_SUBCOMMAND_ERROR,
} from "./subcommands";

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
        const body = args[2];
        let program;
        switch (body.type) {
          case ValueType.SCRIPT:
            program = this.namespace.scope.compileScriptValue(
              body as ScriptValue
            );
            break;
          case ValueType.TUPLE:
            program = this.namespace.scope.compileTupleValue(
              body as TupleValue
            );
            break;
          default:
            return ERROR("body must be a script or tuple");
        }
        return ContinuationValue.create(this.namespace.scope, program);
      },
      call: () => {
        if (args.length < 3)
          return ARITY_ERROR("<namespace> call cmdname ?arg ...?");
        const [result, subcommand] = StringValue.toString(args[2]);
        if (result.code != ResultCode.OK) return ERROR("invalid command name");
        if (!this.namespace.scope.hasLocalCommand(subcommand))
          return ERROR(`unknown command "${subcommand}"`);
        const command = this.namespace.scope.resolveNamedCommand(subcommand);
        const cmdline = [new CommandValue(command), ...args.slice(3)];
        const program = this.namespace.scope.compileArgs(...cmdline);
        return ContinuationValue.create(this.namespace.scope, program);
      },
      import: () => {
        if (args.length != 3 && args.length != 4)
          return ARITY_ERROR("<namespace> import name ?alias?");
        const [result, name] = StringValue.toString(args[2]);
        if (result.code != ResultCode.OK) return ERROR("invalid import name");
        let alias: string;
        if (args.length == 4) {
          const [result, s] = StringValue.toString(args[3]);
          if (result.code != ResultCode.OK) return ERROR("invalid alias name");
          alias = s;
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
  StringValue.toString(name, "<namespace>")[1];
class NamespaceCommand implements Command {
  readonly metacommand: NamespaceMetacommand;
  readonly scope: Scope;
  constructor(scope: Scope) {
    this.scope = scope;
    this.metacommand = new NamespaceMetacommand(this);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.metacommand.value);
    const [result, subcommand] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return INVALID_SUBCOMMAND_ERROR();
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
      return UNKNOWN_SUBCOMMAND_ERROR(subcommand);
    const command = this.scope.resolveNamedCommand(subcommand);
    const cmdline = [new CommandValue(command), ...args.slice(2)];
    const program = this.scope.compileArgs(...cmdline);
    return ContinuationValue.create(this.scope, program);
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip ? "" : NAMESPACE_COMMAND_PREFIX(args[0]);
    const signature = [prefix, usage].filter(Boolean).join(" ");
    if (args.length <= 1) {
      return OK(STR(signature + " ?subcommand? ?arg ...?"));
    }
    const [result, subcommand] = StringValue.toString(args[1]);
    if (result.code != ResultCode.OK) return INVALID_SUBCOMMAND_ERROR();
    if (subcommand == "subcommands") {
      if (args.length > 2) {
        return ARITY_ERROR(signature + " subcommands");
      }
      return OK(STR(signature + " subcommands"));
    }
    if (!this.scope.hasLocalCommand(subcommand))
      return UNKNOWN_SUBCOMMAND_ERROR(subcommand);
    const command = this.scope.resolveNamedCommand(subcommand);
    if (!command.help) return ERROR(`no help for subcommand "${subcommand}"`);
    return command.help(args.slice(1), {
      prefix: signature + " " + subcommand,
      skip: 1,
    });
  }
}

const NAMESPACE_SIGNATURE = "namespace ?name? body";
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

    const subscope = scope.newChildScope();
    const program = subscope.compileScriptValue(body as ScriptValue);
    return ContinuationValue.create(subscope, program, (result) => {
      switch (result.code) {
        case ResultCode.OK:
        case ResultCode.RETURN: {
          const namespace = new NamespaceCommand(subscope);
          if (name) {
            const result = scope.registerCommand(name, namespace);
            if (result.code != ResultCode.OK) return result;
          }
          return OK(
            result.code == ResultCode.RETURN
              ? result.value
              : namespace.metacommand.value
          );
        }
        case ResultCode.ERROR:
          return result;
        default:
          return ERROR("unexpected " + RESULT_CODE_NAME(result));
      }
    });
  },
  help(args) {
    if (args.length > 3) return ARITY_ERROR(NAMESPACE_SIGNATURE);
    return OK(STR(NAMESPACE_SIGNATURE));
  },
};
