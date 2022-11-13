/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode, YIELD, OK, ERROR } from "../core/results";
import { Command } from "../core/command";
import { Program } from "../core/compiler";
import { ScriptValue, Value, ValueType } from "../core/values";
import { ArgspecValue } from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, ScopeContext, Process } from "./core";

class MacroValue extends CommandValue {
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly program: Program;
  readonly macro: Command;
  constructor(
    command: Command,
    argspec: ArgspecValue,
    body: ScriptValue,
    program: Program
  ) {
    super(command);
    this.argspec = argspec;
    this.body = body;
    this.program = program;
    this.macro = new MacroCommand(this);
  }
}
class MacroValueCommand implements Command {
  readonly value: MacroValue;
  constructor(argspec: ArgspecValue, body: ScriptValue, program: Program) {
    this.value = new MacroValue(this, argspec, body, program);
  }

  execute(args: Value[], scope: Scope): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("macro method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "call": {
        if (args.length < 2) return ARITY_ERROR("macro call ?arg ...?");
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
  resume(result: Result, scope: Scope): Result {
    return this.value.macro.resume(result, scope);
  }
}

type MacroState = {
  scope: Scope;
  process: Process;
};
class MacroCommand implements Command {
  readonly value: MacroValue;
  constructor(value: MacroValue) {
    this.value = value;
  }

  execute(args: Value[], scope: Scope): Result {
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
    const result = this.value.argspec.applyArguments(scope, args, 1, setarg);
    if (result.code != ResultCode.OK) return result;
    const subscope = new Scope(scope, new ScopeContext(scope.context, locals));
    const process = subscope.prepareProcess(this.value.program);
    return this.run({ scope: subscope, process });
  }
  resume(result: Result): Result {
    const state = result.data as MacroState;
    state.process.yieldBack(result.value);
    return this.run(state);
  }
  run(state: MacroState) {
    const result = state.process.run();
    if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
    return result;
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

    const result = ArgspecValue.fromValue(scope, specs);
    if (result.code != ResultCode.OK) return result; // TODO handle YIELD?
    const argspec = result.data;
    const program = scope.compile((body as ScriptValue).script);
    const command = new MacroValueCommand(
      argspec,
      body as ScriptValue,
      program
    );
    if (name) {
      scope.registerCommand(name.asString(), command.value.macro);
    }
    return OK(command.value);
  },
};
