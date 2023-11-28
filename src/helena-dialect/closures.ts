/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import {
  STR,
  ScriptValue,
  StringValue,
  TUPLE,
  TupleValue,
  Value,
  ValueType,
} from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, DeferredValue, CommandValue } from "./core";
import { Subcommands } from "./subcommands";

class ClosureMetacommand implements Command {
  readonly value: Value;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly guard: Value;
  readonly closure: ClosureCommand;
  constructor(
    scope: Scope,
    argspec: ArgspecValue,
    body: ScriptValue,
    guard: Value
  ) {
    this.value = new CommandValue(this);
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.guard = guard;
    this.closure = new ClosureCommand(this);
  }

  static readonly subcommands = new Subcommands(["subcommands", "argspec"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.closure.value);
    return ClosureMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<closure> subcommands");
        return OK(ClosureMetacommand.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<closure> argspec");
        return OK(this.argspec);
      },
    });
  }
}

const CLOSURE_COMMAND_SIGNATURE = (name, help) =>
  `${StringValue.toString(name, "<closure>").data}${help ? " " + help : ""}`;
class ClosureCommand implements Command {
  readonly value: Value;
  readonly metacommand: ClosureMetacommand;
  constructor(metacommand: ClosureMetacommand) {
    this.value = new CommandValue(this);
    this.metacommand = metacommand;
  }

  execute(args: Value[]): Result {
    if (!this.metacommand.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        CLOSURE_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage())
      );
    }
    const subscope = new Scope(this.metacommand.scope, true);
    const setarg = (name, value) => {
      subscope.setNamedLocal(name, value);
      return OK(value);
    };
    // TODO handle YIELD?
    const result = this.metacommand.argspec.applyArguments(
      this.metacommand.scope,
      args,
      1,
      setarg
    );
    if (result.code != ResultCode.OK) return result;
    return YIELD(new DeferredValue(this.metacommand.body, subscope));
  }
  resume(result: Result): Result {
    if (this.metacommand.guard) {
      const process = this.metacommand.scope.prepareTupleValue(
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
      : CLOSURE_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage());
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

const CLOSURE_SIGNATURE = "closure ?name? argspec body";
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
        return ARITY_ERROR(CLOSURE_SIGNATURE);
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
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    const metacommand = new ClosureMetacommand(
      scope,
      argspec,
      body as ScriptValue,
      guard
    );
    if (name) {
      const result = scope.registerCommand(name, metacommand.closure);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(metacommand.value);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(CLOSURE_SIGNATURE);
    return OK(STR(CLOSURE_SIGNATURE));
  },
};
