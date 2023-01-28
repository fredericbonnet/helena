/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import { ScriptValue, Value, ValueType } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, DeferredValue, commandValueType } from "./core";

class MacroValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly macro: Command;
  constructor(command: Command, argspec: ArgspecValue, body: ScriptValue) {
    this.command = command;
    this.argspec = argspec;
    this.body = body;
    this.macro = new MacroCommand(this);
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
}
class MacroValueCommand implements Command {
  readonly value: MacroValue;
  constructor(argspec: ArgspecValue, body: ScriptValue) {
    this.value = new MacroValue(this, argspec, body);
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        const cmdline = [this.value, ...args.slice(2)];
        return this.value.macro.execute(cmdline, scope);
      }
      case "argspec":
        if (args.length != 2) return ARITY_ERROR("macro argspec");
        return OK(this.value.argspec);
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}

class MacroCommand implements Command {
  readonly value: MacroValue;
  constructor(value: MacroValue) {
    this.value = value;
  }

  execute(args: Value[], scope: Scope): Result {
    if (!this.value.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(`${args[0].asString()} ${this.value.argspec.help()}`);
    }
    const subscope = new Scope(scope, true);
    const setarg = (name, value) => {
      subscope.setLocal(name, value);
      return OK(value);
    };
    // TODO handle YIELD?
    const result = this.value.argspec.applyArguments(scope, args, 1, setarg);
    if (result.code != ResultCode.OK) return result;
    return YIELD(new DeferredValue(this.value.body, subscope));
  }
}
export const macroCmd: Command = {
  execute: (args, scope: Scope) => {
    let name, specs, body;
    switch (args.length) {
      case 3:
        [, specs, body] = args;
        break;
      case 4:
        [, name, specs, body] = args;
        break;
      default:
        return ARITY_ERROR("macro ?name? argspec body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    const command = new MacroValueCommand(argspec, body as ScriptValue);
    if (name) {
      scope.registerCommand(name.asString(), command.value.macro);
    }
    return OK(command.value);
  },
};
