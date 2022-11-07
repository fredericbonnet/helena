/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  YIELD,
  YIELD_BACK,
} from "../core/results";
import { Command } from "../core/command";
import { Program, Process } from "../core/compiler";
import { Value, ScriptValue, ValueType } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { CommandValue, Scope } from "./core";

class ScopeValue extends CommandValue {
  readonly scope: Scope;
  constructor(command: Command, scope: Scope) {
    super(command);
    this.scope = scope;
  }
}
class ScopeCommand implements Command {
  readonly value: ScopeValue;
  constructor(scope: Scope) {
    this.value = new ScopeValue(this, scope);
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("scope method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("scope eval body");
        if (args[2].type != ValueType.SCRIPT)
          return ERROR("body must be a script");
        const body = args[2] as ScriptValue;
        // TODO handle YIELD
        return this.value.scope.executeScript(body);
      }
      case "call": {
        if (args.length < 3) return ARITY_ERROR("scope call cmdname ?arg ...?");
        const cmdline = args.slice(2);
        if (!this.value.scope.hasLocalCommand(cmdline[0].asString()))
          return ERROR(`invalid command name "${cmdline[0].asString()}"`);
        return this.value.scope
          .resolveCommand(cmdline[0])
          .execute(cmdline, this.value.scope);
      }
      default:
        return ERROR(`invalid method name "${method.asString()}"`);
    }
  }
}
type ScopeBodyState = {
  scope: Scope;
  subscope: Scope;
  program: Program;
  process: Process;
  name?: Value;
};
export const scopeCmd: Command = {
  execute: (args, scope: Scope) => {
    let name, body;
    switch (args.length) {
      case 2:
        [, body] = args;
        break;
      case 3:
        [, name, body] = args;
        break;
      default:
        return ARITY_ERROR("scope ?name? body");
    }
    if (body.type != ValueType.SCRIPT) return ERROR("body must be a script");

    const subscope = new Scope(scope);
    const program = subscope.compile((body as ScriptValue).script);
    const process = new Process();

    return executeScopeBody({ scope, subscope, program, process, name });
  },
  resume(result: Result): Result {
    const state = result.data as ScopeBodyState;
    state.process.result = YIELD_BACK(state.process.result, result.value);
    return executeScopeBody(state);
  },
};
const executeScopeBody = (state: ScopeBodyState): Result => {
  const result = state.subscope.execute(state.program, state.process);

  if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
  if (result.code != ResultCode.OK && result.code != ResultCode.RETURN)
    return result;

  const command = new ScopeCommand(state.subscope);
  if (state.name) {
    state.scope.registerCommand(state.name.asString(), command);
  }

  if (result.code == ResultCode.RETURN) return OK(result.value);
  return OK(command.value);
};
