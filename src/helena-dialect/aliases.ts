/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ResultCode } from "../core/results";
import { Command } from "../core/command";
import { STR, Value } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, expandPrefixCmd, CommandValue } from "./core";
import { Subcommands } from "./subcommands";

class AliasMetacommand implements Command {
  readonly value: Value;
  readonly alias: AliasCommand;
  constructor(alias: AliasCommand) {
    this.value = new CommandValue(this);
    this.alias = alias;
  }

  static readonly subcommands = new Subcommands(["subcommands", "command"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.alias.value);
    return AliasMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<alias> subcommands");
        return OK(AliasMetacommand.subcommands.list);
      },
      command: () => {
        if (args.length != 2) return ARITY_ERROR("<alias> command");
        return OK(this.alias.cmd);
      },
    });
  }
  resume(result: Result, scope: Scope): Result {
    return this.alias.resume(result, scope);
  }
}

class AliasCommand implements Command {
  readonly value: Value;
  readonly cmd: Value;
  readonly metacommand: AliasMetacommand;
  constructor(cmd: Value) {
    this.value = new CommandValue(this);
    this.cmd = cmd;
    this.metacommand = new AliasMetacommand(this);
  }

  execute(args: Value[], scope: Scope): Result {
    const cmdline = [this.cmd, ...args.slice(1)];
    return expandPrefixCmd.execute(cmdline, scope);
  }
  resume(result: Result, scope: Scope): Result {
    return expandPrefixCmd.resume(result, scope);
  }
}

const ALIAS_SIGNATURE = "alias name command";
export const aliasCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 3) return ARITY_ERROR(ALIAS_SIGNATURE);
    const [, name, cmd] = args;

    const alias = new AliasCommand(cmd);
    const result = scope.registerCommand(name, alias);
    if (result.code != ResultCode.OK) return result;
    return OK(alias.metacommand.value);
  },
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(ALIAS_SIGNATURE);
    return OK(STR(ALIAS_SIGNATURE));
  },
};
