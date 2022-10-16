/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, ResultCode, YIELD, OK, ERROR } from "../core/command";
import { Program, Process } from "../core/compiler";
import { ScriptValue, StringValue, Value } from "../core/values";
import {
  applyArguments,
  Argspec,
  checkArity,
  valueToArgspec,
} from "./argspecs";
import { ARITY_ERROR } from "./arguments";
import { Scope, CommandValue, ScopeContext } from "./core";

class ClosureValue extends CommandValue {
  readonly scope: Scope;
  readonly argspec: Argspec;
  readonly body: ScriptValue;
  readonly program: Program;
  readonly closure: Command;
  constructor(
    command: Command,
    scope: Scope,
    argspec: Argspec,
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
  constructor(scope: Scope, argspec: Argspec, body: ScriptValue) {
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
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
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
    if (!checkArity(this.value.argspec, args, 1)) {
      throw new Error(
        `wrong # args: should be "${args[0].asString()} ${this.value.argspec.help.asString()}"`
      );
    }
    const locals: Map<string, Value> = new Map();
    const setarg = (name, value) => {
      locals.set(name, value);
      return OK(value);
    };
    applyArguments(this.value.scope, this.value.argspec, args, 1, setarg);
    const scope = new Scope(
      this.value.scope,
      new ScopeContext(this.value.scope.context, locals)
    );
    const process = new Process();
    return this.run({ scope, process });
  }
  resume(result: Result): Result {
    return this.run(result.state as ClosureState);
  }
  run(state: ClosureState) {
    const result = state.scope.execute(this.value.program, state.process);
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

    const argspec = valueToArgspec(scope, specs);
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
