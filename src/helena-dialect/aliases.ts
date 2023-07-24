/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ResultCode } from "../core/results";
import { Command } from "../core/command";
import { STR, Value } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, commandValueType, expandPrefixCmd } from "./core";
import { Subcommands } from "./subcommands";

class AliasMetacommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly cmd: Value;
  readonly alias: AliasCommand;
  constructor(cmd: Value) {
    this.command = this;
    this.cmd = cmd;
    this.alias = new AliasCommand(this);
  }

  static readonly subcommands = new Subcommands(["subcommands", "command"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.alias);
    return AliasMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<alias> subcommands");
        return OK(AliasMetacommand.subcommands.list);
      },
      command: () => {
        if (args.length != 2) return ARITY_ERROR("<alias> command");
        return OK(this.cmd);
      },
    });
  }
  resume(result: Result, scope: Scope): Result {
    return this.alias.resume(result, scope);
  }
}

class AliasCommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly metacommand: AliasMetacommand;
  constructor(metacommand: AliasMetacommand) {
    this.command = this;
    this.metacommand = metacommand;
  }

  execute(args: Value[], scope: Scope): Result {
    const cmdline = [this.metacommand.cmd, ...args.slice(1)];
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

    const metacommand = new AliasMetacommand(cmd);
    const result = scope.registerCommand(name, metacommand.alias);
    if (result.code != ResultCode.OK) return result;
    return OK(metacommand);
  },
  help: (args) => {
    if (args.length > 3) return ARITY_ERROR(ALIAS_SIGNATURE);
    return OK(STR(ALIAS_SIGNATURE));
  },
};
