/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  ERROR,
  OK,
  Result,
  ResultCode,
  RETURN,
  YIELD,
  YIELD_BACK,
} from "../core/results";
import { Command } from "../core/command";
import {
  Compiler,
  Executor,
  OpCode,
  Program,
  ProgramState,
} from "../core/compiler";
import { VariableResolver, CommandResolver } from "../core/evaluator";
import { Script } from "../core/syntax";
import {
  Value,
  ValueType,
  CustomValueType,
  ScriptValue,
  NumberValue,
  TupleValue,
  NIL,
} from "../core/values";
import { numberCmd } from "./numbers";

export const commandValueType: CustomValueType = { name: "command" };
export interface CommandValue extends Value {
  readonly command: Command;
}

const deferredValueType: CustomValueType = { name: "deferred" };
export class DeferredValue implements Value {
  type = deferredValueType;
  value: Value;
  scope: Scope;
  constructor(value: Value, scope: Scope) {
    this.value = value;
    this.scope = scope;
  }
}

type ProcessContext = {
  scope: Scope;
  program: Program;
  state: ProgramState;
  parent?: ProcessContext;
};
export class Process {
  private context: ProcessContext;
  constructor(scope: Scope, program: Program) {
    this.context = { scope, program, state: new ProgramState() };
  }
  run(): Result {
    for (;;) {
      const result = this.context.scope.execute(
        this.context.program,
        this.context.state
      );
      if (result.value instanceof DeferredValue) {
        const deferred = result.value;
        let process;
        switch (deferred.value.type) {
          case ValueType.SCRIPT:
            process = deferred.scope.prepareScriptValue(
              deferred.value as ScriptValue
            );
            break;
          case ValueType.TUPLE:
            process = deferred.scope.prepareTupleValue(
              deferred.value as TupleValue
            );
            break;
          default:
            return ERROR("body must be a script or tuple");
        }
        const parent = this.context;
        this.context = process.context;
        this.context.parent = parent;
        continue;
      }
      if (result.code == ResultCode.OK && this.context.parent) {
        this.context = this.context.parent;
        switch (this.context.state.result.code) {
          case ResultCode.RETURN:
            return RETURN(result.value);
          case ResultCode.YIELD:
            this.yieldBack(result.value);
            continue;
          default:
            return ERROR("unexpected deferred result");
        }
      }
      return result;
    }
  }
  yieldBack(value: Value) {
    this.context.state.result = YIELD_BACK(this.context.state.result, value);
  }
}

class ScopeContext {
  readonly parent?: ScopeContext;
  readonly constants: Map<string, Value> = new Map();
  readonly variables: Map<string, Value> = new Map();
  readonly commands: Map<string, Command> = new Map();
  constructor(parent?: ScopeContext) {
    this.parent = parent;
  }
}
export class Scope {
  readonly context: ScopeContext;
  private readonly locals: Map<string, Value> = new Map();
  private readonly compiler: Compiler;
  private readonly executor: Executor;

  constructor(parent?: Scope, local = false) {
    this.context = local ? parent.context : new ScopeContext(parent?.context);
    this.compiler = new Compiler();
    const variableResolver: VariableResolver = {
      resolve: (name) => this.resolveVariable(name),
    };
    const commandResolver: CommandResolver = {
      resolve: (name) => this.resolveCommand(name),
    };
    this.executor = new Executor(variableResolver, commandResolver, null, this);
  }

  evaluateSentences(script: ScriptValue): Result {
    const program = this.compiler.compileSentences(script.script.sentences);
    return this.execute(program);
  }

  executeScriptValue(script: ScriptValue): Result {
    return this.executeScript(script.script);
  }
  executeScript(script: Script): Result {
    return this.prepareScript(script).run();
  }

  compile(script: Script): Program {
    return this.compiler.compileScript(script);
  }
  execute(program: Program, state?: ProgramState): Result {
    return this.executor.execute(program, state);
  }

  prepareScriptValue(script: ScriptValue): Process {
    return this.prepareScript(script.script);
  }
  prepareScript(script: Script): Process {
    return this.prepareProcess(this.compile(script));
  }
  prepareTupleValue(tuple: TupleValue): Process {
    const program = new Program();
    program.pushOpCode(OpCode.PUSH_CONSTANT);
    program.pushOpCode(OpCode.EVALUATE_SENTENCE);
    program.pushOpCode(OpCode.PUSH_RESULT);
    program.pushConstant(tuple);
    return this.prepareProcess(program);
  }
  prepareProcess(program: Program): Process {
    return new Process(this, program);
  }

  resolveVariable(name: string): Value {
    if (this.locals.has(name)) return this.locals.get(name);
    if (this.context.constants.has(name))
      return this.context.constants.get(name);
    if (this.context.variables.has(name))
      return this.context.variables.get(name);
    return null;
  }
  resolveCommand(value: Value): Command {
    if (value.type == ValueType.TUPLE) return expandPrefixCmd;
    if (value.type == commandValueType) return (value as CommandValue).command;
    if (NumberValue.isNumber(value)) return numberCmd;
    if (value.asString) return this.resolveNamedCommand(value.asString());
  }
  resolveNamedCommand(name: string): Command {
    let context = this.context;
    while (context) {
      const command = context.commands.get(name);
      if (command) return command;
      context = context.parent;
    }
  }

  setLocal(name: string, value: Value) {
    this.locals.set(name, value);
  }
  setNamedConstant(name: string, value: Value, check = false): Result {
    if (this.locals.has(name)) {
      return ERROR(`cannot define constant "${name}": local already exists`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (this.context.variables.has(name)) {
      return ERROR(`cannot define constant "${name}": variable already exists`);
    }

    if (check) return OK(NIL);
    this.context.constants.set(name, value);
    return OK(value);
  }
  setConstant(constant: Value, value: Value, check = false): Result {
    if (!constant.asString) return ERROR("invalid constant name");
    return this.setNamedConstant(constant.asString(), value, check);
  }
  setConstants(constants: TupleValue, value: Value, check = false): Result {
    if (value.type != ValueType.TUPLE) return ERROR("bad value shape");
    const values = (value as TupleValue).values;
    if (values.length < constants.values.length)
      return ERROR("bad value shape");
    // First pass for error checking
    for (let i = 0; i < constants.values.length; i++) {
      const constant = constants.values[i];
      switch (constant.type) {
        case ValueType.TUPLE: {
          const result = this.setConstants(
            constant as TupleValue,
            values[i],
            true
          );
          if (result.code != ResultCode.OK) return result;
          break;
        }
        default: {
          const result = this.setConstant(constant, values[i], true);
          if (result.code != ResultCode.OK) return result;
        }
      }
    }
    if (check) return OK(NIL);
    // Second pass for actual setting
    for (let i = 0; i < constants.values.length; i++) {
      const constant = constants.values[i];
      switch (constant.type) {
        case ValueType.TUPLE:
          this.setConstants(constant as TupleValue, values[i]);
          break;
        default:
          this.setConstant(constant, values[i]);
      }
    }
    return OK(value);
  }
  setNamedVariable(name: string, value: Value, check = false): Result {
    if (this.locals.has(name)) {
      return ERROR(`cannot redefine local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot redefine constant "${name}"`);
    }
    if (check) return OK(NIL);
    this.context.variables.set(name, value);
    return OK(value);
  }
  setVariable(variable: Value, value: Value, check = false): Result {
    if (!variable.asString) return ERROR("invalid variable name");
    return this.setNamedVariable(variable.asString(), value, check);
  }
  setVariables(variables: TupleValue, value: Value, check = false): Result {
    if (value.type != ValueType.TUPLE) return ERROR("bad value shape");
    const values = (value as TupleValue).values;
    if (values.length < variables.values.length)
      return ERROR("bad value shape");
    // First pass for error checking
    for (let i = 0; i < variables.values.length; i++) {
      const variable = variables.values[i];
      switch (variable.type) {
        case ValueType.TUPLE: {
          const result = this.setVariables(
            variable as TupleValue,
            values[i],
            true
          );
          if (result.code != ResultCode.OK) return result;
          break;
        }
        default: {
          const result = this.setVariable(variable, values[i], true);
          if (result.code != ResultCode.OK) return result;
        }
      }
    }
    if (check) return OK(NIL);
    // Second pass for actual setting
    for (let i = 0; i < variables.values.length; i++) {
      const variable = variables.values[i];
      switch (variable.type) {
        case ValueType.TUPLE:
          this.setVariables(variable as TupleValue, values[i]);
          break;
        default:
          this.setVariable(variable, values[i]);
      }
    }
    return OK(value);
  }
  unsetVariable(variable: Value): Result {
    if (!variable.asString) return ERROR("invalid variable name");
    const name = variable.asString();
    if (this.locals.has(name)) {
      return ERROR(`cannot unset local "${name}"`);
    }
    if (this.context.constants.has(name)) {
      return ERROR(`cannot unset constant "${name}"`);
    }
    if (!this.context.variables.has(name)) {
      return ERROR(`cannot unset "${name}": no such variable`);
    }

    this.context.variables.delete(name);
    return OK(NIL);
  }
  getVariable(variable: Value, def?: Value): Result {
    if (!variable.asString) return ERROR("invalid variable name");
    const name = variable.asString();
    const value = this.resolveVariable(name);
    if (value) return OK(value);
    if (def) return OK(def);
    return ERROR(`cannot get "${name}": no such variable`);
  }
  resolveValue(value: Value): Result {
    const program = new Program();
    program.pushOpCode(OpCode.PUSH_CONSTANT);
    program.pushOpCode(OpCode.RESOLVE_VALUE);
    program.pushConstant(value);
    return this.executor.execute(program);
  }

  registerCommand(name: Value, command: Command): Result {
    if (!name.asString) return ERROR("invalid command name");
    this.context.commands.set(name.asString(), command);
    return OK(NIL);
  }
  registerNamedCommand(name: string, command: Command) {
    this.context.commands.set(name, command);
  }
  hasLocalCommand(name: string): boolean {
    return this.context.commands.has(name);
  }
}

type ExpandPrefixState = {
  command: Command;
  result: Result;
};
export const expandPrefixCmd: Command = {
  execute(args: Value[], scope: Scope): Result {
    const [command, args2] = resolveLeadingTuple(args, scope);
    if (!command) return OK(NIL);
    const result = command.execute(args2, scope);
    if (result.code == ResultCode.YIELD)
      return YIELD(result.value, { command, result });
    return result;
  },
  resume(result: Result, scope: Scope): Result {
    const { command, result: commandResult } = result.data as ExpandPrefixState;
    if (!command.resume) return OK(result.value);
    const result2 = command.resume(
      YIELD_BACK(commandResult, result.value),
      scope
    );
    if (result2.code == ResultCode.YIELD)
      return YIELD(result2.value, { command, result: result2 });
    return result2;
  },
};

function resolveLeadingTuple(args: Value[], scope: Scope): [Command, Value[]] {
  if (args.length == 0) return [null, null];
  const [lead, ...rest] = args;
  if (lead.type != ValueType.TUPLE) {
    const command = scope.resolveCommand(lead);
    return [command, args];
  }
  const tuple = lead as TupleValue;
  return resolveLeadingTuple([...tuple.values, ...rest], scope);
}
