/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import { ScriptValue, Value, ValueType } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, ScopeContext, Process } from "./core";

class ClosureValue extends CommandValue {
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly program: Program;
  readonly closure: Command;
  constructor(
    command: Command,
    scope: Scope,
    argspec: ArgspecValue,
    body: ScriptValue
  ) {
    super(command);
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.program = this.scope.compile(this.body.script);
    this.closure = new ClosureCommand(this);
  }
}
class ClosureValueCommand implements Command {
  readonly value: ClosureValue;
  constructor(scope: Scope, argspec: ArgspecValue, body: ScriptValue) {
    this.value = new ClosureValue(this, scope, argspec, body);
  }
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("closure method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        if (args.length < 2) return ARITY_ERROR("closure call ?arg ...?");
        const cmdline = [this.value, ...args.slice(2)];
        return this.value.closure.execute(cmdline);
      }
      case "argspec":
        if (args.length != 2) return ARITY_ERROR("closure argspec");
        return OK(this.value.argspec);
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}

type ClosureState = {
  scope: Scope;
  process: Process;
};
class ClosureCommand implements Command {
  readonly value: ClosureValue;
  constructor(value: ClosureValue) {
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (!this.value.argspec.checkArity(args, 1)) {
      return ERROR(
        `wrong # args: should be "${args[0].asString()} ${this.value.argspec.help()}"`
      );
    }
    const locals: Map<string, Value> = new Map();
    const setarg = (name, value) => {
      locals.set(name, value);
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
    const subscope = new Scope(
      this.value.scope,
      new ScopeContext(this.value.scope.context, locals)
    );
    const process = subscope.prepareProcess(this.value.program);
    return this.run({ scope: subscope, process });
  }
  resume(result: Result): Result {
    const state = result.data as ClosureState;
    state.process.yieldBack(result.value);
    return this.run(state);
  }
  run(state: ClosureState) {
    const result = state.process.run();
    if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
    return result;
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

    const result = ArgspecValue.fromValue(scope, specs);
    if (result.code != ResultCode.OK) return result; // TODO handle YIELD?
    const argspec = result.data;
    const command = new ClosureValueCommand(
      scope,
      argspec,
      body as ScriptValue
    );
    if (name) {
      scope.registerCommand(name.asString(), command.value.closure);
    }
    return OK(command.value);
  },
};
