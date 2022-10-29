/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, ERROR, OK, Result, ResultCode, YIELD } from "../core/command";
import { Compiler, Executor, Program, Process } from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script, Word } from "../core/syntax";
import {
  Value,
  ValueType,
  ScriptValue,
  NumberValue,
  TupleValue,
  NIL,
} from "../core/values";
import { numberCmd } from "./math";

export class Variable {
  value: Value;
  constructor(value: Value) {
    this.value = value;
  }
}
export class CommandValue implements Value {
  readonly type: ValueType = ValueType.CUSTOM;
  readonly command: Command;

  constructor(command: Command) {
    this.command = command;
  }
  asString(): string {
    throw new Error("Method not implemented.");
  }
  selectIndex(_index: Value): Result {
    throw new Error("Method not implemented.");
  }
  selectKey(_key: Value): Result {
    throw new Error("Method not implemented.");
  }
  selectRules(_rules: Value[]): Result {
    throw new Error("Method not implemented.");
  }
}

export class ScopeContext {
  readonly constants: Map<string, Value>;
  readonly variables: Map<string, Variable>;
  readonly commands: Map<string, Command>;
  readonly locals: Map<string, Value>;
  constructor(context?: ScopeContext, locals?: Map<string, Value>) {
    this.constants = context?.constants ?? new Map();
    this.variables = context?.variables ?? new Map();
    this.commands = context?.commands ?? new Map();
    this.locals = locals;
  }
}

export class Scope {
  readonly parent?: Scope;
  readonly context: ScopeContext;
  private readonly compiler: Compiler;
  private readonly executor: Executor;

  constructor(parent?: Scope, context = new ScopeContext()) {
    this.parent = parent;
    this.context = context;
    this.compiler = new Compiler();
    const variableResolver: VariableResolver = {
      resolve: (name) => this.resolveVariable(name),
    };
    const commandResolver: CommandResolver = {
      resolve: (name) => this.resolveCommand(name),
    };
    this.executor = new Executor(variableResolver, commandResolver, null, this);
  }

  executeScript(script: ScriptValue): Result {
    return this.execute(this.compile(script.script));
  }
  executeWord(word: Word): Result {
    const program = this.compiler.compileWord(word);
    return this.execute(program);
  }
  compile(script: Script): Program {
    return this.compiler.compileScript(script);
  }
  execute(program: Program, process?: Process): Result {
    return this.executor.execute(program, process);
  }

  resolveVariable(name: string): Value {
    if (this.context.locals?.has(name)) return this.context.locals.get(name);
    if (this.context.constants.has(name))
      return this.context.constants.get(name);
    if (this.context.variables.has(name))
      return this.context.variables.get(name).value;
    throw new Error(`can't read "${name}": no such variable`);
  }
  resolveCommand(value: Value, recurse = true): Command {
    if (value.type == ValueType.TUPLE) return tupleCmd;
    if (value instanceof CommandValue) return value.command;
    if (NumberValue.isNumber(value)) return numberCmd;
    return this.resolveNamedCommand(value.asString(), recurse);
  }
  private resolveNamedCommand(name: string, recurse: boolean): Command {
    if (!this.context.commands.has(name)) {
      if (!recurse || !this.parent)
        throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveNamedCommand(name, recurse);
    }
    return this.context.commands.get(name);
  }

  setConstant(name: string, value: Value): Result {
    if (this.context.locals?.has(name)) {
      return ERROR(`cannot redefine local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (this.context.variables.has(name)) {
      return ERROR(`cannot define constant "${name}": variable already exists`);
    }

    this.context.constants.set(name, value);
    return OK(value);
  }
  setVariable(name: string, value: Value): Result {
    if (this.context.locals?.has(name)) {
      return ERROR(`cannot redefine local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (this.context.variables.has(name)) {
      this.context.variables.get(name).value = value;
    } else {
      this.context.variables.set(name, new Variable(value));
    }
    return OK(value);
  }
  getVariable(name: string): Result {
    return OK(this.resolveVariable(name));
  }

  registerCommand(name: string, command: Command) {
    this.context.commands.set(name, command);
  }
}

type TupleState = {
  command: Command;
  result: Result;
};
const tupleCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    const [command, args2] = resolveTuple(args, scope);
    if (!command) return OK(NIL);
    const result = command.execute(args2, scope);
    if (result.code == ResultCode.YIELD)
      return YIELD(result.value, { command, result });
    return result;
  },
  resume(result: Result, scope: Scope): Result {
    const { command, result: commandResult } = result.state as TupleState;
    if (!command.resume) return commandResult;
    const result2 = command.resume(commandResult, scope);
    if (result2.code == ResultCode.YIELD)
      return YIELD(result2.value, { command, result: result2 });
    return result2;
  },
};

function resolveTuple(args: Value[], scope: Scope): [Command, Value[]] {
  if (args.length == 0) return [null, null];
  const [lead, ...rest] = args;
  if (lead.type != ValueType.TUPLE) {
    const command = scope.resolveCommand(lead);
    return [command, args];
  }
  const tuple = lead as TupleValue;
  return resolveTuple([...tuple.values, ...rest], scope);
}
