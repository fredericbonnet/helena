/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, Result, ResultCode } from "../core/command";
import {
  VariableResolver,
  CommandResolver,
  CompilingEvaluator,
  InlineEvaluator,
  Evaluator,
} from "../core/evaluator";
import { Script } from "../core/syntax";
import {
  Value,
  ScriptValue,
  NIL,
  StringValue,
  ValueType,
  TupleValue,
  NumberValue,
  FALSE,
  TRUE,
  BooleanValue,
} from "../core/values";

export class PicolScope {
  parent?: PicolScope;
  variables: Map<string, Value> = new Map();
  commands: Map<string, (scope: PicolScope) => Command> = new Map();
  evaluator: Evaluator;
  constructor(parent?: PicolScope) {
    this.parent = parent;
    this.evaluator = new CompilingEvaluator(
      this.variableResolver,
      this.commandResolver,
      null
    );
  }

  evaluate(script: Script): Value {
    return this.evaluator.evaluateScript(script);
  }

  variableResolver: VariableResolver = {
    resolve: (name) => this.resolveVariable(name),
  };
  commandResolver: CommandResolver = {
    resolve: (name) => this.resolveCommand(name),
  };

  resolveVariable(name: string): Value {
    if (!this.variables.has(name)) {
      throw new Error(`can't read "${name}": no such variable`);
    }
    return this.variables.get(name);
  }
  resolveCommand(name: Value): Command {
    return this.resolveScopedCommand(name.asString())(this);
  }
  resolveScopedCommand(name: string): (scope: PicolScope) => Command {
    if (!this.commands.has(name)) {
      if (!this.parent) throw new Error(`invalid command name "${name}"`);
      return this.parent.resolveScopedCommand(name);
    }
    return this.commands.get(name);
  }
}

const OK = (value: Value): Result => [ResultCode.OK, value];
const RETURN = (value: Value): Result => [ResultCode.RETURN, value];
const BREAK: Result = [ResultCode.BREAK, NIL];
const CONTINUE: Result = [ResultCode.CONTINUE, NIL];
const ERROR = (value: Value): Result => [ResultCode.ERROR, value];

const EMPTY: Result = OK(new StringValue(""));

const ARITY_ERROR = (signature: string) =>
  ERROR(new StringValue(`wrong # args: should be "${signature}"`));

const addCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("+ arg ?arg ...?");
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 0;
      const v = NumberValue.fromValue(arg).value;
      return total + v;
    }, 0);
    return OK(new NumberValue(result));
  },
});
const subtractCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("- arg ?arg ...?");
    if (args.length == 2) {
      const v = NumberValue.fromValue(args[1]).value;
      return OK(new NumberValue(-v));
    }
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 0;
      const v = NumberValue.fromValue(arg).value;
      if (i == 1) return v;
      return total - v;
    }, 0);
    return OK(new NumberValue(result));
  },
});

const multiplyCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("* arg ?arg ...?");
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 1;
      const v = NumberValue.fromValue(arg).value;
      return total * v;
    }, 1);
    return OK(new NumberValue(result));
  },
});
const divideCmd = (): Command => ({
  execute: (args) => {
    if (args.length < 3) return ARITY_ERROR("/ arg arg ?arg ...?");
    const result = args.reduce((total, arg, i) => {
      if (i == 0) return 1;
      const v = NumberValue.fromValue(arg).value;
      if (i == 1) return v;
      return total / v;
    }, 0);
    return OK(new NumberValue(result));
  },
});

const compareValuesCmd =
  (name: string, fn: (op1, op2) => boolean) => (): Command => ({
    execute: (args) => {
      if (args.length != 3) return ARITY_ERROR(`${name} arg arg`);
      return fn(args[1], args[2]) ? OK(TRUE) : OK(FALSE);
    },
  });
const eqCmd = compareValuesCmd(
  "==",
  (op1, op2) => op1 == op2 || op1.asString() == op2.asString()
);
const neCmd = compareValuesCmd(
  "!=",
  (op1, op2) => op1 != op2 && op1.asString() != op2.asString()
);

const compareNumbersCmd =
  (name: string, fn: (op1, op2) => boolean) => (): Command => ({
    execute: (args) => {
      if (args.length != 3) return ARITY_ERROR(`${name} arg arg`);
      const op1 = NumberValue.fromValue(args[1]).value;
      const op2 = NumberValue.fromValue(args[2]).value;
      return fn(op1, op2) ? OK(TRUE) : OK(FALSE);
    },
  });

const gtCmd = compareNumbersCmd(">", (op1, op2) => op1 > op2);
const geCmd = compareNumbersCmd(">=", (op1, op2) => op1 >= op2);
const ltCmd = compareNumbersCmd("<", (op1, op2) => op1 < op2);
const leCmd = compareNumbersCmd("<=", (op1, op2) => op1 <= op2);

const notCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("! arg");
    const [code, v] = evaluateCondition(args[1], scope);
    if (code != ResultCode.OK) return [code, v];
    return (v as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
});
const andCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("&& arg ?arg ...?");
    let result = true;
    for (let i = 1; i < args.length; i++) {
      const [code, v] = evaluateCondition(args[i], scope);
      if (code != ResultCode.OK) return [code, v];
      if (!(v as BooleanValue).value) {
        result = false;
        break;
      }
    }

    return result ? OK(TRUE) : OK(FALSE);
  },
});
const orCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("|| arg ?arg ...?");
    let result = false;
    for (let i = 1; i < args.length; i++) {
      const [code, v] = evaluateCondition(args[i], scope);
      if (code != ResultCode.OK) return [code, v];
      if ((v as BooleanValue).value) {
        result = true;
        break;
      }
    }

    return result ? OK(TRUE) : OK(FALSE);
  },
});

const ifCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length != 3 && args.length != 5) {
      return ARITY_ERROR("if test script1 ?else script2?");
    }
    const [testCode, test] = evaluateCondition(args[1], scope);
    if (testCode != ResultCode.OK) return [testCode, test];
    let script: ScriptValue;
    if ((test as BooleanValue).value) {
      script = args[2] as ScriptValue;
    } else if (args.length == 3) {
      return EMPTY;
    } else {
      script = args[4] as ScriptValue;
    }
    const [code, result] = scope.evaluator.executeScript(script.script);
    if (code != ResultCode.OK) return [code, result];
    return result == NIL ? EMPTY : OK(result);
  },
});
const forCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length != 5) {
      return ARITY_ERROR("for start test next command");
    }
    const start = args[1] as ScriptValue;
    const test = args[2];
    const next = args[3] as ScriptValue;
    const script = args[4] as ScriptValue;
    let code: ResultCode;
    let value: Value;
    [code, value] = scope.evaluator.executeScript(start.script);
    if (code != ResultCode.OK) return [code, value];
    for (;;) {
      [code, value] = evaluateCondition(test, scope);
      if (code != ResultCode.OK) return [code, value];
      if (!(value as BooleanValue).value) break;
      [code, value] = scope.evaluator.executeScript(script.script);
      if (code == ResultCode.BREAK) break;
      if (code == ResultCode.CONTINUE) {
        [code, value] = scope.evaluator.executeScript(next.script);
        if (code != ResultCode.OK) return [code, value];
        continue;
      }
      if (code != ResultCode.OK) return [code, value];
      [code, value] = scope.evaluator.executeScript(next.script);
      if (code != ResultCode.OK) return [code, value];
    }
    return EMPTY;
  },
});
const whileCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length != 3 && args.length != 5) {
      return ARITY_ERROR("while test script");
    }
    const test = args[1];
    const script = args[2] as ScriptValue;
    let code: ResultCode;
    let value: Value;
    for (;;) {
      [code, value] = evaluateCondition(test, scope);
      if (code != ResultCode.OK) return [code, value];
      if (!(value as BooleanValue).value) break;
      [code, value] = scope.evaluator.executeScript(script.script);
      if (code == ResultCode.BREAK) break;
      if (code == ResultCode.CONTINUE) continue;
      if (code != ResultCode.OK) return [code, value];
    }
    return EMPTY;
  },
});

function evaluateCondition(
  value: Value,
  scope: PicolScope
): [ResultCode, Value] {
  if (value.type == ValueType.SCRIPT) {
    const [code, result] = scope.evaluator.executeScript(
      (value as ScriptValue).script
    );
    if (code != ResultCode.OK) return [code, result];
    return [code, BooleanValue.fromValue(result)];
  } else {
    return [ResultCode.OK, BooleanValue.fromValue(value)];
  }
}

const setCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 2:
        return OK(scope.variableResolver.resolve(args[1].asString()));
      case 3:
        scope.variables.set(args[1].asString(), args[2]);
        return OK(args[2]);
      default:
        return ARITY_ERROR("set varName ?newValue?");
    }
  },
});
const incrCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    let increment: number;
    switch (args.length) {
      case 2:
        increment = 1;
        break;
      case 3:
        increment = NumberValue.fromValue(args[2]).value;
        break;
      default:
        return ARITY_ERROR("incr varName ?increment?");
    }
    const varName = args[1].asString();
    const value = scope.variables.get(varName);
    const result = new NumberValue(
      (value ? NumberValue.fromValue(value).value : 0) + increment
    );
    scope.variables.set(varName, result);
    return OK(result);
  },
});

type ArgSpec = {
  name: string;
  default?: Value;
};
class ProcCommand implements Command {
  scope: PicolScope;
  argspecs: ArgSpec[];
  body: ScriptValue;
  constructor(scope: PicolScope, argspecs: ArgSpec[], body: ScriptValue) {
    this.scope = scope;
    this.argspecs = argspecs;
    this.body = body;
  }

  execute(args: Value[]): Result {
    const scope = new PicolScope(this.scope);
    let p, a;
    for (p = 0, a = 1; p < this.argspecs.length; p++, a++) {
      const argspec = this.argspecs[p];
      let value;
      if (p == this.argspecs.length - 1 && argspec.name == "args") {
        value = new TupleValue(args.slice(a));
        a = args.length - 1;
      } else if (p < args.length - 1) {
        value = args[a];
      } else if (argspec.default) {
        value = argspec.default;
      } else {
        return ARITY_ERROR(argspecsToSignature(args[0], this.argspecs));
      }
      scope.variables.set(argspec.name, value);
    }
    if (a < args.length)
      return ARITY_ERROR(argspecsToSignature(args[0], this.argspecs));

    const [code, value] = scope.evaluator.executeScript(this.body.script);
    if (code == ResultCode.ERROR) return [code, value];
    return value == NIL ? EMPTY : OK(value);
  }
}

function valueToList(value: Value): Value[] {
  switch (value.type) {
    case ValueType.TUPLE:
      return (value as TupleValue).values;
    case ValueType.SCRIPT: {
      const evaluator = new InlineEvaluator(null, null, null);
      const values = [];
      for (const sentence of (value as ScriptValue).script.sentences) {
        for (const word of sentence.words) {
          values.push(evaluator.evaluateWord(word));
        }
      }
      return values;
    }
    default:
      throw new Error("unsupported list format");
  }
}

function valueToArgspec(value: Value): ArgSpec {
  switch (value.type) {
    case ValueType.SCRIPT: {
      const values = valueToList(value);
      if (values.length == 0) throw new Error("argument with no name");
      const name = values[0].asString();
      if (name == "") throw new Error("argument with no name");
      switch (values.length) {
        case 1:
          return { name };
        case 2:
          return { name, default: values[1] };
        default:
          throw new Error(
            `too many fields in argument specifier "${value.asString()}"`
          );
      }
    }
    default:
      return { name: value.asString() };
  }
}
function valueToArgspecs(value: Value): ArgSpec[] {
  return valueToList(value).map(valueToArgspec);
}
function argspecsToSignature(name: Value, argspecs: ArgSpec[]): string {
  const chunks = [name.asString()];
  const argspectoSignature = (argspec) =>
    argspec.default ? `?${argspec.name}?` : argspec.name;
  if (argspecs[argspecs.length - 1]?.name == "args") {
    chunks.push(...argspecs.slice(undefined, -1).map(argspectoSignature));
    chunks.push("?arg ...?");
  } else {
    chunks.push(...argspecs.map(argspectoSignature));
  }
  return chunks.join(" ");
}

const procCmd = (scope: PicolScope): Command => ({
  execute: (args) => {
    if (args.length != 4) return ARITY_ERROR("proc name args body");
    const [, name, _argspecs, body] = args;
    const argspecs = valueToArgspecs(_argspecs);
    scope.commands.set(
      name.asString(),
      (scope: PicolScope) =>
        new ProcCommand(scope, argspecs, body as ScriptValue)
    );
    return EMPTY;
  },
});

const returnCmd = (): Command => ({
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("return ?result?");
    return args.length == 2 ? RETURN(args[1]) : RETURN(new StringValue(""));
  },
});
const breakCmd = (): Command => ({
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("break");
    return BREAK;
  },
});
const continueCmd = (): Command => ({
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("continue");
    return CONTINUE;
  },
});
const errorCmd = (): Command => ({
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("error message");
    return ERROR(args[1]);
  },
});

export function initPicolCommands(scope: PicolScope) {
  scope.commands.set("+", addCmd);
  scope.commands.set("-", subtractCmd);
  scope.commands.set("*", multiplyCmd);
  scope.commands.set("/", divideCmd);
  scope.commands.set("==", eqCmd);
  scope.commands.set("!=", neCmd);
  scope.commands.set(">", gtCmd);
  scope.commands.set(">=", geCmd);
  scope.commands.set("<", ltCmd);
  scope.commands.set("<=", leCmd);
  scope.commands.set("!", notCmd);
  scope.commands.set("&&", andCmd);
  scope.commands.set("||", orCmd);
  scope.commands.set("if", ifCmd);
  scope.commands.set("for", forCmd);
  scope.commands.set("while", whileCmd);
  scope.commands.set("set", setCmd);
  scope.commands.set("incr", incrCmd);
  scope.commands.set("proc", procCmd);
  scope.commands.set("return", returnCmd);
  scope.commands.set("break", breakCmd);
  scope.commands.set("continue", continueCmd);
  scope.commands.set("error", errorCmd);
}
