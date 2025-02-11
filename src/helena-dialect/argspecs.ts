/* eslint-disable jsdoc/require-jsdoc */ // TODO
import {
  Result,
  OK,
  ERROR,
  ResultCode,
  RESULT_CODE_NAME,
} from "../core/results";
import { Command, CommandHelpOptions } from "../core/commands";
import {
  Value,
  ValueType,
  ScriptValue,
  NIL,
  STR,
  TUPLE,
  LIST,
  CustomValue,
  StringValue,
  FALSE,
  TRUE,
} from "../core/values";
import {
  Argument,
  ARITY_ERROR,
  buildArguments,
  buildUsage,
  optionName,
  USAGE_PREFIX,
} from "./arguments";
import { Scope } from "./core";
import { valueToArray } from "./lists";
import { EnsembleCommand } from "./ensembles";

export const USAGE_ARGSPEC = (
  name: Value,
  def: string,
  argspec: ArgspecValue,
  options?: CommandHelpOptions
) => {
  const prefix = USAGE_PREFIX(name, def, options);
  const usage = options?.skip
    ? argspec.usage(options.skip - 1)
    : argspec.usage(0);
  return [prefix, usage].filter(Boolean).join(" ");
};

export class Argspec {
  readonly args: Argument[];
  readonly nbRequired: number = 0;
  readonly nbOptional: number = 0;
  readonly hasRemainder: boolean = false;
  readonly optionSlots: Map<string, number>;
  constructor(args: Argument[]) {
    this.args = args;
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      if (arg.option) {
        if (arg.type == "required") this.nbRequired += 2;
        if (!this.optionSlots) this.optionSlots = new Map<string, number>();
        for (const name of arg.option.names) this.optionSlots.set(name, i);
      } else {
        switch (arg.type) {
          case "required":
            this.nbRequired++;
            break;
          case "optional":
            this.nbOptional++;
            break;
          case "remainder":
            this.hasRemainder = true;
            break;
        }
      }
    }
  }
  isVariadic(): boolean {
    return this.nbOptional > 0 || this.hasRemainder;
  }
  hasOptions(): boolean {
    return !!this.optionSlots?.size;
  }
}

export class ArgspecValue implements CustomValue {
  readonly type = ValueType.CUSTOM;
  readonly customType = { name: "argspec" };

  readonly argspec: Argspec;
  constructor(argspec: Argspec) {
    this.argspec = argspec;
  }

  static fromValue(value: Value): [Result, ArgspecValue?] {
    if (value instanceof ArgspecValue) return [OK(value), value];
    const [result, args] = buildArguments(value);
    if (result.code != ResultCode.OK) return [result];
    const v = new ArgspecValue(new Argspec(args));
    return [OK(v), v];
  }

  usage(skip = 0): string {
    return buildUsage(this.argspec.args, skip);
  }
  checkArity(values: Value[], skip: number) {
    if (this.argspec.hasOptions()) {
      // There is no fast way to check arity without parsing all options, so
      // just check that there are enough to cover all the required ones
      return values.length - skip >= this.argspec.nbRequired;
    }
    return (
      values.length - skip >= this.argspec.nbRequired &&
      (this.argspec.hasRemainder ||
        values.length - skip <=
          this.argspec.nbRequired + this.argspec.nbOptional)
    );
  }
  applyArguments(
    scope: Scope,
    values: Value[],
    skip: number,
    setArgument: (name: string, value: Value) => Result
  ): Result {
    if (!this.argspec.hasOptions()) {
      // Use faster algorithm for the common case with all positionals
      return this.applyPositionals(scope, values, skip, setArgument);
    }
    const [result, data] = this.findSlots(values, skip);
    if (result.code != ResultCode.OK) return result;
    const { slots, remainders } = data;
    for (let slot = 0; slot < this.argspec.args.length; slot++) {
      const arg = this.argspec.args[slot];
      let value;
      switch (arg.type) {
        case "required":
          if (slots[slot] < 0) {
            if (arg.option) {
              return ERROR(
                `missing value for option "${optionName(arg.option.names)}"`
              );
            } else {
              return ERROR(`missing value for argument "${arg.name}"`);
            }
          }
          value = values[slots[slot]];
          break;
        case "optional":
          if (slots[slot] >= 0) {
            if (arg.option && arg.option.type == "flag") {
              value = TRUE;
            } else {
              value = values[slots[slot]];
            }
          } else if (arg.option && arg.option.type == "flag") {
            value = FALSE;
          } else if (arg.default) {
            if (arg.default.type == ValueType.SCRIPT) {
              const program = scope.compileScriptValue(
                arg.default as ScriptValue
              );
              const result = scope.execute(program);
              switch (result.code) {
                case ResultCode.OK:
                  value = result.value;
                  break;
                case ResultCode.ERROR:
                  return result;
                default:
                  return ERROR("unexpected " + RESULT_CODE_NAME(result));
              }
            } else {
              value = arg.default;
            }
          } else continue; // Skip missing optional
          break;
        case "remainder":
          {
            if (slots[slot] < 0) {
              // No remainder
              value = TUPLE([]);
            } else {
              value = TUPLE(
                values.slice(slots[slot], slots[slot] + remainders)
              );
            }
          }
          break;
      }
      const result = this.setArgument(scope, arg, value, setArgument);
      switch (result.code) {
        case ResultCode.OK:
          break;
        case ResultCode.ERROR:
          return result;
        default:
          return ERROR("unexpected " + RESULT_CODE_NAME(result));
      }
    }
    return OK(NIL);
  }
  private findSlots(
    values: Value[],
    skip: number
  ): [Result, { slots: number[]; remainders: number }?] {
    let nbRequired = this.argspec.nbRequired;
    let nbOptional = this.argspec.nbOptional;
    let remainders = 0;
    const nbArgs = this.argspec.args.length;
    const slots = new Array(nbArgs);
    slots.fill(-1);
    // Consume positional arguments and options alternatively
    let slot = 0;
    let i = skip;
    while (i < values.length) {
      // Positional arguments in order
      let firstSlot = slot;
      let lastSlot = slot;
      while (lastSlot < nbArgs) {
        const arg = this.argspec.args[lastSlot];
        if (arg.option) break;
        lastSlot++;
      }
      while (i < values.length && slot < lastSlot) {
        const arg = this.argspec.args[slot];
        const remaining = values.length - i;
        switch (arg.type) {
          case "required":
            nbRequired--;
            slots[slot] = i++;
            break;
          case "optional":
            if (remaining > nbRequired) {
              nbOptional--;
              slots[slot] = i++;
            }
            break;
          case "remainder":
            if (remaining > nbRequired + nbOptional) {
              remainders = remaining - nbRequired - nbOptional;
              slots[slot] = i;
              i += remainders;
            }
            break;
        }
        slot++;
      }
      if (i >= values.length) break;

      // Options out-of-order
      let requiredOptions = 0;
      firstSlot = slot;
      while (lastSlot < nbArgs) {
        const arg = this.argspec.args[lastSlot];
        if (!arg.option) break;
        if (arg.type == "required") requiredOptions++;
        lastSlot++;
      }
      let nbOptions = 0;
      while (i < values.length && nbOptions < lastSlot - firstSlot) {
        const [result, optname] = StringValue.toString(values[i]);
        if (result.code != ResultCode.OK) {
          if (!requiredOptions) break;
          return [ERROR("invalid option")];
        }
        if (optname == "--") {
          if (!requiredOptions) break;
          return [ERROR("unexpected option terminator")];
        }
        if (!this.argspec.optionSlots.has(optname)) {
          if (!requiredOptions) break;
          return [ERROR(`unknown option "${optname}"`)];
        }
        const optionSlot = this.argspec.optionSlots.get(optname);
        if (optionSlot < firstSlot || optionSlot >= lastSlot) {
          return [ERROR(`unexpected option "${optname}"`)];
        }
        const arg = this.argspec.args[optionSlot];
        if (slots[optionSlot] >= 0) {
          return [
            ERROR(
              `duplicate values for option "${optionName(arg.option.names)}"`
            ),
          ];
        }
        nbOptions++;
        switch (arg.option.type) {
          case "flag":
            slots[optionSlot] = i++;
            break;
          case "option":
            switch (arg.type) {
              case "required":
                nbRequired -= 2;
                slots[optionSlot] = i + 1;
                requiredOptions--;
                i += 2;
                break;
              case "optional":
                slots[optionSlot] = i + 1;
                i += 2;
                break;
            }
            break;
        }
      }
      if (i < values.length) {
        // Skip first trailing terminator
        const [result, optname] = StringValue.toString(values[i]);
        if (result.code == ResultCode.OK && optname == "--") {
          i++;
        }
      }
      slot = lastSlot;
      if (slot >= nbArgs) break;
    }
    if (i < values.length) return [ERROR("extra values after arguments")];
    return [OK(NIL), { slots, remainders }];
  }
  private applyPositionals(
    scope: Scope,
    values: Value[],
    skip: number,
    setArgument: (name: string, value: Value) => Result
  ): Result {
    const total = values.length - skip;
    const nbNonRequired = total - this.argspec.nbRequired;
    let nbOptional = Math.min(this.argspec.nbOptional, nbNonRequired);
    const remainders = nbNonRequired - nbOptional;
    let i = skip;
    for (const arg of this.argspec.args) {
      let value: Value;
      switch (arg.type) {
        case "required":
          value = values[i++];
          break;
        case "optional":
          if (nbOptional > 0) {
            nbOptional--;
            value = values[i++];
          } else if (arg.default) {
            if (arg.default.type == ValueType.SCRIPT) {
              const program = scope.compileScriptValue(
                arg.default as ScriptValue
              );
              const result = scope.execute(program);
              switch (result.code) {
                case ResultCode.OK:
                  value = result.value;
                  break;
                case ResultCode.ERROR:
                  return result;
                default:
                  return ERROR("unexpected " + RESULT_CODE_NAME(result));
              }
            } else {
              value = arg.default;
            }
          } else continue; // Skip missing optional
          break;
        case "remainder":
          value = TUPLE(values.slice(i, i + remainders));
          i += remainders;
          break;
      }
      const result = this.setArgument(scope, arg, value, setArgument);
      switch (result.code) {
        case ResultCode.OK:
          break;
        case ResultCode.ERROR:
          return result;
        default:
          return ERROR("unexpected " + RESULT_CODE_NAME(result));
      }
    }
    return OK(NIL);
  }
  private setArgument(
    scope: Scope,
    arg: Argument,
    value: Value,
    setArgument: (name: string, value: Value) => Result
  ): Result {
    if (arg.guard) {
      const program = scope.compileArgs(arg.guard, value);
      const process = scope.prepareProcess(program);
      const result = process.run();
      if (result.code != ResultCode.OK) return result;
      value = result.value;
    }
    return setArgument(arg.name, value);
  }
}

class ArgspecCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = scope.newChildScope();
    const [, argspec] = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return ArgspecValue.fromValue(args[1])[0];
    return this.ensemble.execute(args, scope);
  }
  help(args) {
    return this.ensemble.help(args);
  }
}

const ARGSPEC_USAGE_SIGNATURE = "argspec value usage";
const argspecUsageCmd: Command = {
  execute(args) {
    if (args.length != 2) return ARITY_ERROR(ARGSPEC_USAGE_SIGNATURE);
    const [result, value] = ArgspecValue.fromValue(args[1]);
    if (result.code != ResultCode.OK) return result;
    return OK(STR(value.usage()));
  },
  help(args) {
    if (args.length > 2) return ARITY_ERROR(ARGSPEC_USAGE_SIGNATURE);
    return OK(STR(ARGSPEC_USAGE_SIGNATURE));
  },
};

const ARGSPEC_SET_SIGNATURE = "argspec value set values";
const argspecSetCmd: Command = {
  execute(args, scope: Scope) {
    if (args.length != 3) return ARITY_ERROR(ARGSPEC_SET_SIGNATURE);
    const [result, value] = ArgspecValue.fromValue(args[1]);
    if (result.code != ResultCode.OK) return result;
    const [result2, values] = valueToArray(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    if (!value.checkArity(values, 0))
      return ERROR(`wrong # values: should be "${value.usage()}"`);
    return value.applyArguments(scope, values, 0, (name, value) =>
      scope.setNamedVariable(name, value)
    );
  },
  help(args) {
    if (args.length > 3) return ARITY_ERROR(ARGSPEC_SET_SIGNATURE);
    return OK(STR(ARGSPEC_SET_SIGNATURE));
  },
};

export function registerArgspecCommands(scope: Scope) {
  const command = new ArgspecCommand(scope);
  scope.registerNamedCommand("argspec", command);
  command.scope.registerNamedCommand("usage", argspecUsageCmd);
  command.scope.registerNamedCommand("set", argspecSetCmd);
}
