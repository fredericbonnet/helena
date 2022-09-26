/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Command, OK, ERROR } from "../core/command";
import { StringValue } from "../core/values";
import { ARITY_ERROR } from "./arguments";
import { Scope, Variable } from "./core";

export const letCmd = (scope: Scope): Command => ({
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
export const setCmd = (scope: Scope): Command => ({
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
export const getCmd = (scope: Scope): Command => ({
  execute: (args) => {
    switch (args.length) {
      case 2:
        return OK(scope.variableResolver.resolve(args[1].asString()));
      default:
        return ARITY_ERROR("get varname");
    }
  },
});
