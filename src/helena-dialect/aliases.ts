/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ERROR, ResultCode } from "../core/results";
import { Command } from "../core/command";
import { Value } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, commandValueType, expandPrefixCmd } from "./core";

class AliasValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly cmd: Value;
  readonly alias: AliasCommand;
  constructor(cmd: Value) {
    this.command = this;
    this.cmd = cmd;
    this.alias = new AliasCommand(this);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.alias);
    const subcommand = args[1].asString?.();
    if (subcommand == null) return ERROR("invalid subcommand name");
    switch (subcommand) {
      case "command": {
        if (args.length != 2) return ARITY_ERROR("<alias> command");
        return OK(this.cmd);
      }
      default:
        return ERROR(`unknown subcommand "${subcommand}"`);
    }
  }
  resume(result: Result, scope: Scope): Result {
    return this.alias.resume(result, scope);
  }
}

class AliasCommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly value: AliasValue;
  constructor(value: AliasValue) {
    this.command = this;
    this.value = value;
  }

  execute(args: Value[], scope: Scope): Result {
    const cmdline = [this.value.cmd, ...args.slice(1)];
    return expandPrefixCmd.execute(cmdline, scope);
  }
  resume(result: Result, scope: Scope): Result {
    return expandPrefixCmd.resume(result, scope);
  }
}

export const aliasCmd: Command = {
  execute: (args, scope: Scope) => {
    if (args.length != 3) return ARITY_ERROR("alias name command");
    const [, name, cmd] = args;

    const value = new AliasValue(cmd);
    const result = scope.registerCommand(name, value.alias);
    if (result.code != ResultCode.OK) return result;
    return OK(value);
  },
};
