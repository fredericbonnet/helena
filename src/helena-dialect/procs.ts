/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  ResultCode,
  YIELD,
  OK,
  ERROR,
  CustomResultCode,
} from "../core/results";
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import { ScriptValue, Value, ValueType } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, commandValueType, Process } from "./core";

class ProcValue implements CommandValue {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly program: Program;
  readonly proc: Command;
  constructor(
    command: Command,
    scope: Scope,
    argspec: ArgspecValue,
    body: ScriptValue,
    program: Program
  ) {
    this.command = command;
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.program = program;
    this.proc = new ProcCommand(this);
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
}
class ProcValueCommand implements Command {
  readonly value: ProcValue;
  constructor(
    scope: Scope,
    argspec: ArgspecValue,
    body: ScriptValue,
    program: Program
  ) {
    this.value = new ProcValue(this, scope, argspec, body, program);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        const cmdline = [this.value, ...args.slice(2)];
        return this.value.proc.execute(cmdline);
      }
      case "argspec":
        if (args.length != 2) return ARITY_ERROR("proc argspec");
        return OK(this.value.argspec);
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
  resume(result: Result): Result {
    return this.value.proc.resume(result);
  }
}

type ProcState = {
  scope: Scope;
  process: Process;
};
class ProcCommand implements Command {
  readonly value: ProcValue;
  constructor(value: ProcValue) {
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (!this.value.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(`${args[0].asString()} ${this.value.argspec.help()}`);
    }
    const subscope = new Scope(this.value.scope);
    const setarg = (name, value) => {
      subscope.setVariable(name, value);
      return OK(value);
    };
    const result = this.value.argspec.applyArguments(
      this.value.scope,
      args,
      1,
      setarg
    );
    if (result.code != ResultCode.OK) return result;
    const process = subscope.prepareProcess(this.value.program);
    return this.run({ scope: subscope, process });
  }
  resume(result: Result): Result {
    const state = result.data as ProcState;
    state.process.yieldBack(result.value);
    return this.run(state);
  }
  private run(state: ProcState) {
    const result = state.process.run();
    if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
    switch (result.code) {
      case ResultCode.OK:
        return result;
      case ResultCode.RETURN:
        return OK(result.value);
      case ResultCode.YIELD:
      case ResultCode.ERROR:
        return result;
      case ResultCode.BREAK:
        return ERROR("unexpected break");
      case ResultCode.CONTINUE:
        return ERROR("unexpected continue");
      default:
        return ERROR("unexpected " + (result.code as CustomResultCode).name);
    }
  }
}
export const procCmd: Command = {
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
        return ARITY_ERROR("proc ?name? argspec body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const result = ArgspecValue.fromValue(specs);
    if (result.code != ResultCode.OK) return result;
    const argspec = result.data;
    const program = scope.compile((body as ScriptValue).script);
    const command = new ProcValueCommand(
      scope,
      argspec,
      body as ScriptValue,
      program
    );
    if (name) {
      scope.registerCommand(name.asString(), command.value.proc);
    }
    return OK(command.value);
  },
};
