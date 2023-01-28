/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import { Value } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, commandValueType, expandPrefixCmd } from "./core";

class AliasValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;
  readonly cmd: Value;
  readonly alias: Command;
  constructor(command: Command, cmd: Value) {
    this.command = command;
    this.cmd = cmd;
    this.alias = new AliasCommand(this);
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
}
class AliasValueCommand implements Command {
  readonly value: AliasValue;
  constructor(cmd: Value) {
    this.value = new AliasValue(this, cmd);
  }
  execute(args: Value[], scope): Result {
    if (args.length == 1) return OK(this.value);
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        const cmdline = [this.value, ...args.slice(2)];
        return this.value.alias.execute(cmdline, scope);
      }
      case "command": {
        if (args.length != 2) return ARITY_ERROR("alias command");
        return OK(this.value.cmd);
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
  resume(result: Result, scope: Scope): Result {
    return this.value.alias.resume(result, scope);
  }
}

class AliasCommand implements Command {
  readonly value: AliasValue;
  constructor(value: AliasValue) {
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

    const command = new AliasValueCommand(cmd);
    scope.registerCommand(name.asString(), command.value.alias);
    return OK(command.value);
  },
};
