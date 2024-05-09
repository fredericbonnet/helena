/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, OK, ERROR, ResultCode } from "../core/results";
import { Command } from "../core/command";
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
import { Argument, ARITY_ERROR, buildArguments, buildUsage } from "./arguments";
import { Scope } from "./core";
import { valueToArray } from "./lists";
import { EnsembleCommand } from "./ensembles";

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
        switch (arg.type) {
          case "required":
            this.nbRequired += 2;
            break;
          case "optional":
            this.nbOptional += arg.option.type == "flag" ? 1 : 2;
            break;
          default:
            throw new Error("CANTHAPPEN");
        }
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

  static fromValue(value: Value): Result<ArgspecValue> {
    if (value instanceof ArgspecValue) return OK(value, value);
    const { data: args, ...result } = buildArguments(value);
    if (result.code != ResultCode.OK) return result;
    const v = new ArgspecValue(new Argspec(args));
    return OK(v, v);
  }

  usage(skip = 0): string {
    return buildUsage(this.argspec.args, skip);
  }
  checkArity(values: Value[], skip: number) {
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
    const { data: slots, ...result } = this.findSlots(values, skip);
    if (result.code != ResultCode.OK) return result;
    for (let slot = 0; slot < this.argspec.args.length; slot++) {
      const arg = this.argspec.args[slot];
      let value;
      switch (arg.type) {
        case "required":
          if (slots[slot] < 0) {
            if (arg.option) {
              return ERROR(
                `missing value for option "${arg.option.names.join("|")}"`
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
              const body = arg.default as ScriptValue;
              const result = scope.executeScriptValue(body);
              // TODO handle YIELD?
              if (result.code != ResultCode.OK) return result;
              value = result.value;
            } else {
              value = arg.default;
            }
          } else continue; // Skip missing optional
          break;
        case "remainder":
          {
            const remainders = Math.max(
              0,
              values.length -
                skip -
                this.argspec.nbRequired -
                this.argspec.nbOptional
            );
            value = TUPLE(values.slice(slots[slot], slots[slot] + remainders));
          }
          break;
      }
      const result = this.setArgument(scope, arg, value, setArgument);
      // TODO handle YIELD?
      if (result.code != ResultCode.OK) return result;
    }
    return OK(NIL);
  }
  private findSlots(values: Value[], skip: number): Result<number[]> {
    const nonRequired = values.length - skip - this.argspec.nbRequired;
    let optionals = Math.min(this.argspec.nbOptional, nonRequired);
    const remainders = nonRequired - optionals;
    const nbArgs = this.argspec.args.length;
    const slots = new Array(nbArgs);
    slots.fill(-1);
    // Consume positional arguments and options alternatively
    let lastSlot = 0;
    let slot = 0;
    let i = skip;
    while (i < values.length) {
      // Positional arguments in order
      while (lastSlot < nbArgs) {
        const arg = this.argspec.args[lastSlot];
        if (arg.option) break;
        lastSlot++;
      }
      while (i < values.length && slot < lastSlot) {
        const arg = this.argspec.args[slot];
        switch (arg.type) {
          case "required":
            slots[slot] = i++;
            break;
          case "optional":
            if (optionals >= 1) {
              optionals--;
              slots[slot] = i++;
            }
            break;
          case "remainder": {
            if (remainders > 0) {
              slots[slot] = i;
              i += remainders;
            }
            break;
          }
        }
        slot++;
      }
      if (i >= values.length) break;

      // Options out-of-order
      let requiredOptions = 0;
      while (lastSlot < nbArgs) {
        const arg = this.argspec.args[lastSlot];
        if (!arg.option) break;
        if (arg.type == "required") requiredOptions++;
        lastSlot++;
      }
      let nbOptions = 0;
      while (i < values.length && slot + nbOptions < lastSlot) {
        const { data: optname, code } = StringValue.toString(values[i]);
        if (code != ResultCode.OK) {
          if (!requiredOptions) break;
          return ERROR("invalid option");
        }
        if (!this.argspec.optionSlots.has(optname)) {
          if (!requiredOptions) break;
          return ERROR(`unknown option "${optname}"`);
        }
        const optionSlot = this.argspec.optionSlots.get(optname);
        if (optionSlot < slot || optionSlot >= lastSlot) {
          return ERROR(`unexpected option "${optname}"`);
        }
        const arg = this.argspec.args[optionSlot];
        if (slots[optionSlot] >= 0)
          return ERROR(
            `duplicate values for option "${arg.option.names.join("|")}"`
          );
        nbOptions++;
        switch (arg.option.type) {
          case "flag":
            if (optionals >= 1) {
              optionals--;
              slots[optionSlot] = i++;
            }
            break;
          case "option":
            switch (arg.type) {
              case "required":
                slots[optionSlot] = i + 1;
                requiredOptions--;
                i += 2;
                break;
              case "optional":
                if (optionals >= 2) {
                  optionals -= 2;
                  slots[optionSlot] = i + 1;
                  i += 2;
                }
                break;
            }
            break;
        }
      }
      slot = lastSlot;
      if (slot >= nbArgs) break;
    }
    if (optionals) return ERROR("argument mismatch"); // TODO find better error
    return OK(NIL, slots);
  }
  private applyPositionals(
    scope: Scope,
    values: Value[],
    skip: number,
    setArgument: (name: string, value: Value) => Result
  ): Result {
    const nonRequired = values.length - skip - this.argspec.nbRequired;
    let optionals = Math.min(this.argspec.nbOptional, nonRequired);
    const remainders = nonRequired - optionals;
    let i = skip;
    for (const arg of this.argspec.args) {
      let value: Value;
      switch (arg.type) {
        case "required":
          value = values[i++];
          break;
        case "optional":
          if (optionals > 0) {
            optionals--;
            value = values[i++];
          } else if (arg.default) {
            if (arg.default.type == ValueType.SCRIPT) {
              const body = arg.default as ScriptValue;
              const result = scope.executeScriptValue(body);
              // TODO handle YIELD?
              if (result.code != ResultCode.OK) return result;
              value = result.value;
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
      // TODO handle YIELD?
      if (result.code != ResultCode.OK) return result;
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
      const process = scope.prepareTupleValue(TUPLE([arg.guard, value]));
      const result = process.run();
      // TODO handle YIELD?
      if (result.code != ResultCode.OK) return result;
      value = result.value;
    }
    return setArgument(arg.name, value);
  }

  setArguments(values: Value[], scope: Scope): Result {
    if (!this.checkArity(values, 0))
      return ERROR(`wrong # values: should be "${this.usage()}"`);
    return this.applyArguments(scope, values, 0, (name, value) =>
      scope.setNamedVariable(name, value)
    );
  }
}

class ArgspecCommand implements Command {
  scope: Scope;
  ensemble: EnsembleCommand;
  constructor(scope: Scope) {
    this.scope = new Scope(scope);
    const { data: argspec } = ArgspecValue.fromValue(LIST([STR("value")]));
    this.ensemble = new EnsembleCommand(this.scope, argspec);
  }
  execute(args: Value[], scope: Scope): Result {
    if (args.length == 2) return ArgspecValue.fromValue(args[1]);
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
    const { data: value, ...result } = ArgspecValue.fromValue(args[1]);
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
    const { data: value, ...result } = ArgspecValue.fromValue(args[1]);
    if (result.code != ResultCode.OK) return result;
    const { data: values, ...result2 } = valueToArray(args[2]);
    if (result2.code != ResultCode.OK) return result2;
    return value.setArguments(values, scope);
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
