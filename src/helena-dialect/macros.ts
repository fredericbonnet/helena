/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import {
  ScriptValue,
  TUPLE,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, DeferredValue, commandValueType } from "./core";
import { Subcommands } from "./subcommands";

class MacroValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly guard: Value;
  readonly macro: MacroCommand;
  constructor(argspec: ArgspecValue, body: ScriptValue, guard: Value) {
    this.command = this;
    this.argspec = argspec;
    this.body = body;
    this.guard = guard;
    this.macro = new MacroCommand(this);
  }

  static readonly subcommands = new Subcommands(["subcommands", "argspec"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.macro);
    return MacroValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<macro> subcommands");
        return OK(MacroValue.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<macro> argspec");
        return OK(this.argspec);
      },
    });
  }
}

class MacroCommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly value: MacroValue;
  constructor(value: MacroValue) {
    this.command = this;
    this.value = value;
  }

  execute(args: Value[], scope: Scope): Result {
    if (!this.value.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        `${args[0].asString?.() ?? "<macro>"} ${this.value.argspec.help()}`
      );
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
  resume(result: Result, scope: Scope): Result {
    if (this.value.guard) {
      const process = scope.prepareTupleValue(
        TUPLE([this.value.guard, result.value])
      );
      // TODO handle YIELD?
      return process.run();
    }
    return OK(result.value);
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
    let guard;
    switch (body.type) {
      case ValueType.SCRIPT:
        break;
      case ValueType.TUPLE: {
        const bodySpec = (body as TupleValue).values;
        switch (bodySpec.length) {
          case 0:
            return ERROR("empty body specifier");
          case 2:
            [guard, body] = bodySpec;
            break;
          default:
            return ERROR(`invalid body specifier`);
        }
        if (body.type != ValueType.SCRIPT)
          return ERROR("body must be a script");
        break;
      }
      default:
        return ERROR("body must be a script");
    }

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    const value = new MacroValue(argspec, body as ScriptValue, guard);
    if (name) {
      const result = scope.registerCommand(name, value.macro);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(value);
  },
};
