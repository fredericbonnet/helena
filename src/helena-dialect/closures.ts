/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, OK, ERROR, YIELD } from "../core/results";
import { Command } from "../core/command";
import {
  CommandValue,
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
import { Scope } from "./core";
import { Subcommands } from "./subcommands";

class ClosureMetacommand implements Command {
  readonly value: Value;
  readonly closure: ClosureCommand;
  constructor(closure: ClosureCommand) {
    this.value = new CommandValue(this);
    this.closure = closure;
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
        return OK(this.closure.argspec);
      },
    });
  }
}

const CLOSURE_COMMAND_SIGNATURE = (name, help) =>
  `${StringValue.toString(name, "<closure>").data}${help ? " " + help : ""}`;
class ClosureCommand implements Command {
  readonly value: Value;
  readonly metacommand: ClosureMetacommand;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly guard: Value;
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
    this.metacommand = new ClosureMetacommand(this);
  }

  execute(args: Value[]): Result {
    if (!this.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        CLOSURE_COMMAND_SIGNATURE(args[0], this.argspec.usage())
      );
    }
    const subscope = new Scope(this.scope, true);
    const setarg = (name, value) => {
      subscope.setNamedLocal(name, value);
      return OK(value);
    };
    // TODO handle YIELD?
    const result = this.argspec.applyArguments(this.scope, args, 1, setarg);
    if (result.code != ResultCode.OK) return result;
    const program = subscope.compileScriptValue(this.body as ScriptValue);
    const process = subscope.prepareProcess(program);
    return this.run({ process, done: false });
  }
  resume(result: Result): Result {
    const state = result.data;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (state as any).process.yieldBack(result.value);
    return this.run(state);
  }
  private run(state) {
    const result = state.process.run();
    if (result.code == ResultCode.YIELD) {
      return YIELD(result.value, state);
    }
    if (result.code == ResultCode.OK) {
      if (!state.done && this.guard) {
        state.done = true;
        const program = this.scope.compileTupleValue(
          TUPLE([this.guard, result.value])
        );
        state.process = this.scope.prepareProcess(program);
        const result2 = state.process.run();
        if (result2.code == ResultCode.YIELD) {
          return YIELD(result2.value, state);
        }
        return result2;
      }
      return OK(result.value);
    }
    return result;
  }
  help(args: Value[], { prefix, skip }) {
    const usage = skip
      ? this.argspec.usage(skip - 1)
      : CLOSURE_COMMAND_SIGNATURE(args[0], this.argspec.usage());
    const signature = [prefix, usage].filter(Boolean).join(" ");
    if (
      !this.argspec.checkArity(args, 1) &&
      args.length > this.argspec.argspec.nbRequired
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
    if (body.type == ValueType.TUPLE) {
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
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    const closure = new ClosureCommand(
      new Scope(scope, true),
      argspec,
      body as ScriptValue,
      guard
    );
    if (name) {
      const result = scope.registerCommand(name, closure);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(closure.metacommand.value);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(CLOSURE_SIGNATURE);
    return OK(STR(CLOSURE_SIGNATURE));
  },
};
