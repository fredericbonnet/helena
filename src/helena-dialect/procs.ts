/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  ResultCode,
  YIELD,
  OK,
  ERROR,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command } from "../core/command";
import { Program } from "../core/compiler";
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
import { Scope, CommandValue, commandValueType, Process } from "./core";
import { Subcommands } from "./subcommands";

class ProcMetacommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly scope: Scope;
  readonly argspec: ArgspecValue;
  readonly body: ScriptValue;
  readonly guard: Value;
  readonly program: Program;
  readonly proc: ProcCommand;
  constructor(
    scope: Scope,
    argspec: ArgspecValue,
    body: ScriptValue,
    guard: Value,
    program: Program
  ) {
    this.command = this;
    this.scope = scope;
    this.argspec = argspec;
    this.body = body;
    this.guard = guard;
    this.program = program;
    this.proc = new ProcCommand(this);
  }

  static readonly subcommands = new Subcommands(["subcommands", "argspec"]);
  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.proc);
    return ProcMetacommand.subcommands.dispatch(args[1], {
      subcommands: () => {
        if (args.length != 2) return ARITY_ERROR("<proc> subcommands");
        return OK(ProcMetacommand.subcommands.list);
      },
      argspec: () => {
        if (args.length != 2) return ARITY_ERROR("<proc> argspec");
        return OK(this.argspec);
      },
    });
  }
  resume(result: Result): Result {
    return this.proc.resume(result);
  }
}

const PROC_COMMAND_SIGNATURE = (name, help) =>
  `${name.asString?.() ?? "<proc>"}${help ? " " + help : ""}`;
type ProcState = {
  scope: Scope;
  process: Process;
};
class ProcCommand implements CommandValue, Command {
  readonly type = commandValueType;
  readonly command: Command;
  readonly metacommand: ProcMetacommand;
  constructor(metacommand: ProcMetacommand) {
    this.command = this;
    this.metacommand = metacommand;
  }

  execute(args: Value[]): Result {
    if (!this.metacommand.argspec.checkArity(args, 1)) {
      return ARITY_ERROR(
        PROC_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage())
      );
    }
    const subscope = new Scope(this.metacommand.scope);
    const setarg = (name, value) => {
      subscope.setNamedVariable(name, value);
      return OK(value);
    };
    const result = this.metacommand.argspec.applyArguments(
      this.metacommand.scope,
      args,
      1,
      setarg
    );
    if (result.code != ResultCode.OK) return result;
    const process = subscope.prepareProcess(this.metacommand.program);
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
      case ResultCode.RETURN:
        if (this.metacommand.guard) {
          const process = this.metacommand.scope.prepareTupleValue(
            TUPLE([this.metacommand.guard, result.value])
          );
          // TODO handle YIELD?
          return process.run();
        }
        return OK(result.value);
      case ResultCode.ERROR:
        return result;
      default:
        return ERROR("unexpected " + RESULT_CODE_NAME(result.code));
    }
  }
  help(args: Value[]): Result {
    if (
      !this.metacommand.argspec.checkArity(args, 1) &&
      args.length > this.metacommand.argspec.argspec.nbRequired
    ) {
      return ARITY_ERROR(
        PROC_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage())
      );
    }
    return OK(
      STR(PROC_COMMAND_SIGNATURE(args[0], this.metacommand.argspec.usage()))
    );
  }
}

const PROC_SIGNATURE = "proc ?name? argspec body";
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
        return ARITY_ERROR(PROC_SIGNATURE);
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
    const program = scope.compile((body as ScriptValue).script);
    const metacommand = new ProcMetacommand(
      scope,
      argspec,
      body as ScriptValue,
      guard,
      program
    );
    if (name) {
      const result = scope.registerCommand(name, metacommand.proc);
      if (result.code != ResultCode.OK) return result;
    }
    return OK(metacommand);
  },
  help: (args) => {
    if (args.length > 4) return ARITY_ERROR(PROC_SIGNATURE);
    return OK(STR(PROC_SIGNATURE));
  },
};
