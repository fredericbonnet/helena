/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  ResultCode,
  OK,
  RETURN,
  BREAK,
  CONTINUE,
  ERROR,
} from "../core/results";
import { Command } from "../core/command";
import { VariableResolver, CommandResolver } from "../core/resolvers";
import {
  CompilingEvaluator,
  InlineEvaluator,
  Evaluator,
} from "../core/evaluator";
import {
  Value,
  ScriptValue,
  NIL,
  ValueType,
  TupleValue,
  RealValue,
  FALSE,
  TRUE,
  BooleanValue,
  IntegerValue,
  INT,
  REAL,
  STR,
  TUPLE,
  BOOL,
  StringValue,
} from "../core/values";
import { Word } from "../core/syntax";

export class PicolScope {
  readonly parent?: PicolScope;
  readonly variables: Map<string, Value> = new Map();
  readonly commands: Map<string, Command> = new Map();
  readonly evaluator: Evaluator;
  constructor(parent?: PicolScope) {
    this.parent = parent;
    this.evaluator = new CompilingEvaluator(
      this.variableResolver,
      this.commandResolver,
      null,
      this
    );
  }

  private variableResolver: VariableResolver = {
    resolve: (name) => this.resolveVariable(name),
  };
  private commandResolver: CommandResolver = {
    resolve: (name) => this.resolveCommand(name),
  };

  resolveVariable(name: string): Value {
    if (this.variables.has(name)) {
      return this.variables.get(name);
    }
    return null;
  }
  resolveCommand(name: Value): Command {
    return this.resolveNamedCommand(StringValue.toString(name).data);
  }
  private resolveNamedCommand(name: string): Command {
    if (!this.commands.has(name)) {
      if (!this.parent) return;
      return this.parent.resolveNamedCommand(name);
    }
    return this.commands.get(name);
  }
}

const asString = (value: Value) => StringValue.toString(value).data;

const EMPTY: Result = OK(STR(""));

const ARITY_ERROR = (signature: string) =>
  ERROR(`wrong # args: should be "${signature}"`);

const addCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("+ arg ?arg ...?");
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(REAL(first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total += result.data;
    }
    return OK(REAL(total));
  },
};
const subtractCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("- arg ?arg ...?");
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(REAL(-first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total -= result.data;
    }
    return OK(REAL(total));
  },
};

const multiplyCmd: Command = {
  execute: (args) => {
    if (args.length < 2) return ARITY_ERROR("* arg ?arg ...?");
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    if (args.length == 2) {
      return OK(REAL(first));
    }
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total *= result.data;
    }
    return OK(REAL(total));
  },
};
const divideCmd: Command = {
  execute: (args) => {
    if (args.length < 3) return ARITY_ERROR("/ arg arg ?arg ...?");
    const result = RealValue.toNumber(args[1]);
    if (result.code != ResultCode.OK) return result;
    const first = result.data;
    let total = first;
    for (let i = 2; i < args.length; i++) {
      const result = RealValue.toNumber(args[i]);
      if (result.code != ResultCode.OK) return result;
      total /= result.data;
    }
    return OK(REAL(total));
  },
};

const compareValuesCmd = (
  name: string,
  fn: (op1, op2) => boolean
): Command => ({
  execute: (args) => {
    if (args.length != 3) return ARITY_ERROR(`${name} arg arg`);
    return fn(args[1], args[2]) ? OK(TRUE) : OK(FALSE);
  },
});
const eqCmd = compareValuesCmd(
  "==",
  (op1, op2) => op1 == op2 || asString(op1) == asString(op2)
);
const neCmd = compareValuesCmd(
  "!=",
  (op1, op2) => op1 != op2 && asString(op1) != asString(op2)
);

const compareNumbersCmd = (
  name: string,
  fn: (op1, op2) => boolean
): Command => ({
  execute: (args) => {
    if (args.length != 3) return ARITY_ERROR(`${name} arg arg`);
    const result1 = RealValue.toNumber(args[1]);
    if (result1.code != ResultCode.OK) return result1;
    const op1 = result1.data;
    const result2 = RealValue.toNumber(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    const op2 = result2.data;
    return fn(op1, op2) ? OK(TRUE) : OK(FALSE);
  },
});

const gtCmd = compareNumbersCmd(">", (op1, op2) => op1 > op2);
const geCmd = compareNumbersCmd(">=", (op1, op2) => op1 >= op2);
const ltCmd = compareNumbersCmd("<", (op1, op2) => op1 < op2);
const leCmd = compareNumbersCmd("<=", (op1, op2) => op1 <= op2);

const notCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length != 2) return ARITY_ERROR("! arg");
    const result = evaluateCondition(args[1], scope);
    if (result.code != ResultCode.OK) return result;
    return (result.value as BooleanValue).value ? OK(FALSE) : OK(TRUE);
  },
};
const andCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length < 2) return ARITY_ERROR("&& arg ?arg ...?");
    let r = true;
    for (let i = 1; i < args.length; i++) {
      const result = evaluateCondition(args[i], scope);
      if (result.code != ResultCode.OK) return result;
      if (!(result.value as BooleanValue).value) {
        r = false;
        break;
      }
    }

    return r ? OK(TRUE) : OK(FALSE);
  },
};
const orCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length < 2) return ARITY_ERROR("|| arg ?arg ...?");
    let r = false;
    for (let i = 1; i < args.length; i++) {
      const result = evaluateCondition(args[i], scope);
      if (result.code != ResultCode.OK) return result;
      if ((result.value as BooleanValue).value) {
        r = true;
        break;
      }
    }

    return r ? OK(TRUE) : OK(FALSE);
  },
};

const ifCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length != 3 && args.length != 5) {
      return ARITY_ERROR("if test script1 ?else script2?");
    }
    const testResult = evaluateCondition(args[1], scope);
    if (testResult.code != ResultCode.OK) return testResult;
    let script: ScriptValue;
    if ((testResult.value as BooleanValue).value) {
      script = args[2] as ScriptValue;
    } else if (args.length == 3) {
      return EMPTY;
    } else {
      script = args[4] as ScriptValue;
    }
    const result = scope.evaluator.evaluateScript(script.script);
    if (result.code != ResultCode.OK) return result;
    return result.value == NIL ? EMPTY : OK(result.value);
  },
};
const forCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length != 5) {
      return ARITY_ERROR("for start test next command");
    }
    const start = args[1] as ScriptValue;
    const test = args[2];
    const next = args[3] as ScriptValue;
    const script = args[4] as ScriptValue;
    let result: Result;
    result = scope.evaluator.evaluateScript(start.script);
    if (result.code != ResultCode.OK) return result;
    for (;;) {
      result = evaluateCondition(test, scope);
      if (result.code != ResultCode.OK) return result;
      if (!(result.value as BooleanValue).value) break;
      result = scope.evaluator.evaluateScript(script.script);
      if (result.code == ResultCode.BREAK) break;
      if (result.code == ResultCode.CONTINUE) {
        result = scope.evaluator.evaluateScript(next.script);
        if (result.code != ResultCode.OK) return result;
        continue;
      }
      if (result.code != ResultCode.OK) return result;
      result = scope.evaluator.evaluateScript(next.script);
      if (result.code != ResultCode.OK) return result;
    }
    return EMPTY;
  },
};
const whileCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length != 3 && args.length != 5) {
      return ARITY_ERROR("while test script");
    }
    const test = args[1];
    const script = args[2] as ScriptValue;
    let result: Result;
    for (;;) {
      result = evaluateCondition(test, scope);
      if (result.code != ResultCode.OK) return result;
      if (!(result.value as BooleanValue).value) break;
      result = scope.evaluator.evaluateScript(script.script);
      if (result.code == ResultCode.BREAK) break;
      if (result.code == ResultCode.CONTINUE) continue;
      if (result.code != ResultCode.OK) return result;
    }
    return EMPTY;
  },
};

function evaluateCondition(value: Value, scope: PicolScope): Result {
  if (value.type == ValueType.BOOLEAN) return OK(value);
  if (value.type == ValueType.INTEGER) return OK(BOOL(value as IntegerValue));
  if (value.type == ValueType.SCRIPT) {
    const result = scope.evaluator.evaluateScript(
      (value as ScriptValue).script
    );
    if (result.code != ResultCode.OK) return result;
    return BooleanValue.fromValue(result.value);
  }
  const s = asString(value);
  if (s == "true" || s == "yes" || s == "1") return OK(TRUE);
  if (s == "false" || s == "no" || s == "0") return OK(FALSE);
  const i = parseInt(s);
  if (isNaN(i)) return ERROR(`invalid boolean "${s}"`);
  return OK(BOOL(i));
}

const setCmd: Command = {
  execute: (args, scope: PicolScope) => {
    switch (args.length) {
      case 2: {
        const name = asString(args[1]);
        const value = scope.resolveVariable(name);
        if (value) return OK(value);
        return ERROR(`can't read "${name}": no such variable`);
      }
      case 3:
        scope.variables.set(asString(args[1]), args[2]);
        return OK(args[2]);
      default:
        return ARITY_ERROR("set varName ?newValue?");
    }
  },
};
const incrCmd: Command = {
  execute: (args, scope: PicolScope) => {
    let increment: number;
    switch (args.length) {
      case 2:
        increment = 1;
        break;
      case 3:
        {
          const result = IntegerValue.toInteger(args[2]);
          if (result.code != ResultCode.OK) return result;
          increment = result.data;
        }
        break;
      default:
        return ARITY_ERROR("incr varName ?increment?");
    }
    const varName = asString(args[1]);
    const value = scope.variables.get(varName);
    let incremented;
    if (value) {
      const result = IntegerValue.toInteger(value);
      if (result.code != ResultCode.OK) return result;
      incremented = INT(result.data + increment);
    } else {
      incremented = INT(increment);
    }
    scope.variables.set(varName, incremented);
    return OK(incremented);
  },
};

type ArgSpec = {
  name: string;
  default?: Value;
};
class ProcCommand implements Command {
  readonly argspecs: ArgSpec[];
  readonly body: ScriptValue;
  constructor(argspecs: ArgSpec[], body: ScriptValue) {
    this.argspecs = argspecs;
    this.body = body;
  }

  execute(args: Value[], parent: PicolScope): Result {
    const scope = new PicolScope(parent);
    let p, a;
    for (p = 0, a = 1; p < this.argspecs.length; p++, a++) {
      const argspec = this.argspecs[p];
      let value;
      if (p == this.argspecs.length - 1 && argspec.name == "args") {
        value = TUPLE(args.slice(a));
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

    const result = scope.evaluator.evaluateScript(this.body.script);
    if (result.code == ResultCode.ERROR) return result;
    return result.value == NIL ? EMPTY : OK(result.value);
  }
}

function valueToArray(value: Value): Result<Value[]> {
  switch (value.type) {
    case ValueType.TUPLE:
      return OK(NIL, (value as TupleValue).values);
    case ValueType.SCRIPT: {
      const evaluator = new InlineEvaluator(null, null, null);
      const values = [];
      for (const sentence of (value as ScriptValue).script.sentences) {
        for (const word of sentence.words) {
          if (word instanceof Word) {
            const result = evaluator.evaluateWord(word);
            if (result.code != ResultCode.OK) return result as Result<Value[]>;
            values.push(result.value);
          } else {
            values.push(word);
          }
        }
      }
      return OK(NIL, values);
    }
    default:
      return ERROR("unsupported list format");
  }
}

function valueToArgspec(value: Value): Result<ArgSpec> {
  switch (value.type) {
    case ValueType.SCRIPT: {
      const { data: values, ...result } = valueToArray(value);
      if (result.code != ResultCode.OK) return result;
      if (values.length == 0) return ERROR("argument with no name");
      const name = asString(values[0]);
      if (!name) return ERROR("argument with no name");
      switch (values.length) {
        case 1:
          return OK(NIL, { name });
        case 2:
          return OK(NIL, { name, default: values[1] });
        default:
          return ERROR(
            `too many fields in argument specifier "${asString(value)}"`
          );
      }
    }
    default:
      return OK(NIL, { name: asString(value) });
  }
}
function valueToArgspecs(value: Value): Result<ArgSpec[]> {
  const { data: values, ...result } = valueToArray(value);
  if (result.code != ResultCode.OK) return result;
  const argspecs: ArgSpec[] = [];
  for (const value of values) {
    const { data: argspec, ...result } = valueToArgspec(value);
    if (result.code != ResultCode.OK) return result;
    argspecs.push(argspec);
  }
  return OK(NIL, argspecs);
}
function argspecsToSignature(name: Value, argspecs: ArgSpec[]): string {
  const chunks = [asString(name)];
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

const procCmd: Command = {
  execute: (args, scope: PicolScope) => {
    if (args.length != 4) return ARITY_ERROR("proc name args body");
    const [, name, _argspecs, body] = args;
    const { data: argspecs, ...result } = valueToArgspecs(_argspecs);
    if (result.code != ResultCode.OK) return result;
    scope.commands.set(
      asString(name),
      new ProcCommand(argspecs, body as ScriptValue)
    );
    return EMPTY;
  },
};

const returnCmd: Command = {
  execute: (args) => {
    if (args.length > 2) return ARITY_ERROR("return ?result?");
    return args.length == 2 ? RETURN(args[1]) : RETURN(STR(""));
  },
};
const breakCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("break");
    return BREAK();
  },
};
const continueCmd: Command = {
  execute: (args) => {
    if (args.length != 1) return ARITY_ERROR("continue");
    return CONTINUE();
  },
};
const errorCmd: Command = {
  execute: (args) => {
    if (args.length != 2) return ARITY_ERROR("error message");
    return { code: ResultCode.ERROR, value: args[1] };
  },
};

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
