/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Command,
  Result,
  ResultCode,
  OK,
  ERROR,
  RETURN,
  YIELD,
} from "../core/command";
import {
  Compiler,
  ExecutionContext,
  Executor,
  Program,
} from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script } from "../core/syntax";
import {
  Value,
  StringValue,
  ScriptValue,
  ValueType,
  NIL,
} from "../core/values";

export class Variable {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}
type ScopedCommand = (scope: Scope) => Command;
export class CommandValue implements Value {
  readonly type: ValueType = ValueType.CUSTOM;
  command: ScopedCommand;

  constructor(command: ScopedCommand) {
    this.command = command;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(_index: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectKey(_key: Value): Value {
    throw new Error("Method not implemented.");
  }
  selectRules(_rules: Value[]): Value {
    throw new Error("Method not implemented.");
  }
}
export class Scope {
  readonly parent?: Scope;
  readonly constants: Map<string, Value> = new Map();
  readonly variables: Map<string, Variable> = new Map();
  readonly commands: Map<string, ScopedCommand> = new Map();
  readonly compiler: Compiler;
  readonly executor: Executor;

  constructor(parent?: Scope) {
    this.parent = parent;
    this.compiler = new Compiler();
    this.executor = new Executor(
      this.variableResolver,
      this.commandResolver,
      null
    );
  }

  executeScript(script: ScriptValue): Result {
    return this.execute(this.compile(script.script));
  }
  compile(script: Script): Program {
    return this.compiler.compileScript(script);
  }
  execute(program: Program, context?: ExecutionContext): Result {
    return this.executor.execute(program, context);
  }

  variableResolver: VariableResolver = {
    resolve: (name) => this.resolveVariable(name),
  };
  commandResolver: CommandResolver = {
    resolve: (name) => this.resolveCommand(name),
  };

  resolveVariable(name: string): Value {
    if (this.constants.has(name)) return this.constants.get(name);
    if (this.variables.has(name)) return this.variables.get(name).value;
    throw new Error(`can't read "${name}": no such variable`);
  }
  resolveCommand(value: Value, recurse = true): Command {
    if (value instanceof CommandValue) return value.command(this);
    return this.resolveScopedCommand(value.asString(), recurse)(this);
  }
  resolveScopedCommand(name: string, recurse: boolean): ScopedCommand {
    if (!this.commands.has(name)) {
      if (!recurse || !this.parent)
        throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveScopedCommand(name, recurse);
    }
    return this.commands.get(name);
  }
}

const ARITY_ERROR = (signature: string) =>
  ERROR(new StringValue(`wrong # args: should be "${signature}"`));

const idemCmd = (): Command => ({
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("idem value");
    return OK(args[1]);
  },
});

const letCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 3: {
        const name = args[1].asString();
        if (scope.constants.has(name)) {
          return ERROR(new StringValue(`cannot redefine constant "${name}"`));
        }
        if (scope.variables.has(name)) {
          return ERROR(
            new StringValue(
              `cannot define constant "${name}": variable already exists`
            )
          );
        }

        scope.constants.set(name, args[2]);
        return OK(args[2]);
      }
      default:
        return ARITY_ERROR("let constname value");
    }
  },
});
const setCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 3: {
        const name = args[1].asString();
        if (scope.constants.has(name)) {
          return ERROR(new StringValue(`cannot redefine constant "${name}"`));
        }
        if (scope.variables.has(name)) {
          const box = scope.variables.get(name);
          box.value = args[2];
        } else {
          scope.variables.set(args[1].asString(), new Variable(args[2]));
        }
        return OK(args[2]);
      }
      default:
        return ARITY_ERROR("set varname value");
    }
  },
});
const getCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 2:
        return OK(scope.variableResolver.resolve(args[1].asString()));
      default:
        return ARITY_ERROR("get varname");
    }
  },
});

type ArgSpec = {
  name: string;
  default?: Value;
};

class ScopeValue extends CommandValue {
  readonly scope: Scope;
  constructor(scope: Scope) {
    super(() => new ScopeCommand(scope, this));
    this.scope = scope;
  }
}
class ScopeCommand implements Command {
  readonly scope: Scope;
  readonly value: ScopeValue;
  constructor(scope: Scope, value: ScopeValue) {
    this.scope = scope;
    this.value = value;
  }

  execute(args: Value[]): Result {
    if (args.length == 1) return OK(this.value);
    if (args.length < 2) return ARITY_ERROR("scope method ?arg ...?");
    const method = args[1];
    switch (method.asString()) {
      case "eval": {
        if (args.length != 3) return ARITY_ERROR("scope eval body");
        const body = args[2] as ScriptValue;
        return this.scope.executeScript(body);
      }
      case "call": {
        if (args.length < 3) return ARITY_ERROR("scope call cmdname ?arg ...?");
        const cmdline = args.slice(2);
        return this.scope.resolveCommand(cmdline[0], false).execute(cmdline);
      }
      default:
        return ERROR(
          new StringValue(`invalid method name "${method.asString()}"`)
        );
    }
  }
}
type ScopeBodyState = {
  scope: Scope;
  subscope: Scope;
  program: Program;
  context: ExecutionContext;
  name?: Value;
};
const scopeCmd = (scope: Scope): Command => ({
  execute: (args) => {
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

    const subscope = new Scope(scope);
    const program = subscope.compile((body as ScriptValue).script);
    const context = new ExecutionContext();

    return executeScopeBody({ scope, subscope, program, context, name });
  },
  resume(result: Result): Result {
    return executeScopeBody(result.state as ScopeBodyState);
  },
});
const executeScopeBody = (state: ScopeBodyState): Result => {
  const result = state.subscope.execute(state.program, state.context);

  if (result.code == ResultCode.YIELD) return YIELD(result.value, state);
  if (result.code != ResultCode.OK && result.code != ResultCode.RETURN)
    return result;

  const value = new ScopeValue(state.subscope);
  if (state.name) {
    state.scope.commands.set(state.name.asString(), value.command);
    state.scope.variables.set(state.name.asString(), new Variable(value));
  }

  if (result.code == ResultCode.RETURN) return OK(result.value);
  return OK(value);
};

class MacroCommand implements Command {
  readonly scope: Scope;
  readonly argspecs: ArgSpec[];
  readonly body: ScriptValue;
  readonly program: Program;
  constructor(scope: Scope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
    this.program = this.scope.compile(this.body.script);
  }

  execute(_args: Value[]): Result {
    // TODO args
    return this.run(new ExecutionContext());
  }
  resume(result: Result): Result {
    return this.run(result.state as ExecutionContext);
  }
  run(context: ExecutionContext) {
    const result = this.scope.execute(this.program, context);
    if (result.code == ResultCode.YIELD) return YIELD(result.value, context);
    return result;
  }
}
const macroCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let name, argspecs, body;
    switch (args.length) {
      case 3:
        [, argspecs, body] = args;
        break;
      case 4:
        [, name, argspecs, body] = args;
        break;
      default:
        return ARITY_ERROR("macro ?name? args body");
    }

    const command = (scope: Scope) =>
      new MacroCommand(scope, valueToArgspecs(argspecs), body as ScriptValue);
    const value = new CommandValue(command);
    if (name) {
      scope.commands.set(name.asString(), command);
      scope.variables.set(name.asString(), new Variable(value));
    }

    return OK(value);
  },
});

class ClosureCommand implements Command {
  readonly scope: Scope;
  readonly argspecs: ArgSpec[];
  readonly body: ScriptValue;
  readonly program: Program;
  constructor(scope: Scope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
    this.program = this.scope.compile(this.body.script);
  }

  execute(_args: Value[]): Result {
    // TODO args
    return this.run(new ExecutionContext());
  }
  resume(result: Result): Result {
    return this.run(result.state as ExecutionContext);
  }
  run(context: ExecutionContext) {
    const result = this.scope.execute(this.program, context);
    if (result.code == ResultCode.YIELD) return YIELD(result.value, context);
    return result;
  }
}
const closureCmd = (scope: Scope): Command => ({
  execute: (args) => {
    let name, argspecs, body;
    switch (args.length) {
      case 3:
        [, argspecs, body] = args;
        break;
      case 4:
        [, name, argspecs, body] = args;
        break;
      default:
        return ARITY_ERROR("closure ?name? args body");
    }

    const command = () =>
      new ClosureCommand(scope, valueToArgspecs(argspecs), body as ScriptValue);
    const value = new CommandValue(command);
    if (name) {
      scope.commands.set(name.asString(), command);
      scope.variables.set(name.asString(), new Variable(value));
    }

    return OK(value);
  },
});

const returnCmd = (): Command => ({
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("return ?result?");
    return args.length == 2 ? RETURN(args[1]) : RETURN(NIL);
  },
});

const yieldCmd = (): Command => ({
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("yield ?result?");
    return args.length == 2 ? YIELD(args[1]) : YIELD(NIL);
  },
});

function valueToArgspecs(_value: Value): ArgSpec[] {
  // TODO
  return [];
}

export function initCommands(scope: Scope) {
  scope.commands.set("idem", idemCmd);

  scope.commands.set("let", letCmd);
  scope.commands.set("set", setCmd);
  scope.commands.set("get", getCmd);

  scope.commands.set("scope", scopeCmd);

  scope.commands.set("macro", macroCmd);
  scope.commands.set("closure", closureCmd);

  scope.commands.set("return", returnCmd);
  scope.commands.set("yield", yieldCmd);
}
