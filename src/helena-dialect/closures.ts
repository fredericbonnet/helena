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

class ClosureValue implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
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
    this.command = this;
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.guard = guard;
    this.closure = new ClosureCommand(this);
  }

  static readonly subcommands = new Subcommands(["subcommands", "argspec"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.closure);
    return ClosureValue.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<closure> subcommands");
        return OK(ClosureValue.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<closure> argspec");
        return OK(this.argspec);
      },
    });
  }
}
class ClosureCommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly value: ClosureValue;
  constructor(value: ClosureValue) {
    this.command = this;
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (!this.value.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        `${args[0].asString?.() ?? "<closure>"} ${this.value.argspec.usage()}`
      );
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
  resume(result: Result): Result {
    if (this.value.guard) {
      const process = this.value.scope.prepareTupleValue(
        TUPLE([this.value.guard, result.value])
      );
      // TODO handle YIELD?
      return process.run();
    }
    return OK(result.value);
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
    const value = new ClosureValue(scope, argspec, body as ScriptValue, guard);
    if (name) {
      const result = scope.registerCommand(name, value.closure);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(value);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(CLOSURE_SIGNATURE);
    return OK(STR(CLOSURE_SIGNATURE));
  },
};
