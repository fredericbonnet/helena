/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result } from "../core/command";
import {
  Compiler,
  Executor,
  Program,
  ExecutionContext,
} from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script } from "../core/syntax";
import { Value, ValueType, ScriptValue } from "../core/values";

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
