/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import { ScriptValue, Value, ValueType } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, DeferredValue, commandValueType } from "./core";

class ClosureValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly closure: Command;
  constructor(scope: Scope, argspec: ArgspecValue, body: ScriptValue) {
    this.command = this;
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.closure = new ClosureCommand(this);
  }

  asString(): string {
    throw new Error("Method not implemented.");
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this);
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        const cmdline = [this, ...args.slice(2)];
        return this.closure.execute(cmdline);
      }
      case "argspec":
        if (args.length != 2) return ARITY_ERROR("closure argspec");
        return OK(this.argspec);
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}
class ClosureCommand implements Command {
  readonly value: ClosureValue;
  constructor(value: ClosureValue) {
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (!this.value.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(`${args[0].asString()} ${this.value.argspec.help()}`);
    }
    const subscope = new Scope(this.value.scope, true);
    const setarg = (name, value) => {
      subscope.setLocal(name, value);
      return OK(value);
    };
    // TODO handle YIELD?
    const result = this.value.argspec.applyArguments(
      this.value.scope,
      args,
      1,
      setarg
    );
    if (result.code != ResultCode.OK) return result;
    return YIELD(new DeferredValue(this.value.body, subscope));
  }
}
export const closureCmd: Command = {
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
        return ARITY_ERROR("closure ?name? argspec body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    const value = new ClosureValue(scope, argspec, body as ScriptValue);
    if (name) {
      scope.registerCommand(name.asString(), value.closure);
    }
    return OK(value);
  },
};
