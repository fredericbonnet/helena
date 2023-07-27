/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import {
  STR,
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

class MacroMetacommand implements CommandValue, Command {
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
    return MacroMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<macro> subcommands");
        return OK(MacroMetacommand.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<macro> argspec");
        return OK(this.argspec);
      },
    });
  }
}

const MACRO_COMMAND_SIGNATURE = (name, help) =>
  `${name.asString?.() ?? "<macro>"}${help ? " " + help : ""}`;
class MacroCommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly metacommand: MacroMetacommand;
  constructor(metacommand: MacroMetacommand) {
    this.command = this;
    this.metacommand = metacommand;
  }

  execute(args: Value[], scope: Scope): Result {
    if (!this.metacommand.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        MACRO_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage())
      );
    }
    const subscope = new Scope(scope, true);
    const setarg = (name, value) => {
      subscope.setLocal(name, value);
      return OK(value);
    };
    // TODO handle YIELD?
    const result = this.metacommand.argspec.applyArguments(
      scope,
      args,
      1,
      setarg
    );
    if (result.code != ResultCode.OK) return result;
    return YIELD(new DeferredValue(this.metacommand.body, subscope));
  }
  resume(result: Result, scope: Scope): Result {
    if (this.metacommand.guard) {
      const process = scope.prepareTupleValue(
        TUPLE([this.metacommand.guard, result.value])
      );
      // TODO handle YIELD?
      return process.run();
    }
    return OK(result.value);
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip
      ? this.metacommand.argspec.usage(skip - 1)
      : MACRO_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage());
    const signature = [prefix, usage].filter(Boolean).join(" ");
    if (
      !this.metacommand.argspec.checkArity(args, 1) &&
      args.length > this.metacommand.argspec.argspec.nbRequired
    ) {
      return ARITY_ERROR(signature);
    }
    return OK(STR(signature));
  }
}

const MACRO_SIGNATURE = "macro ?name? argspec body";
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
        return ARITY_ERROR(MACRO_SIGNATURE);
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
    const metacommand = new MacroMetacommand(
      argspec,
      body as ScriptValue,
      guard
    );
    if (name) {
      const result = scope.registerCommand(name, metacommand.macro);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(metacommand);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(MACRO_SIGNATURE);
    return OK(STR(MACRO_SIGNATURE));
  },
};
