/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { Result, ResultCode } from "../../core/results";
import { STR, Value, StringValue } from "../../core/values";
import { Scope } from "../../helena-dialect/core";
import { Module } from "../../helena-dialect/modules";
import { CallbackContext, fsCmd } from "./fs";

/**
 * Main dynamic module entry point.
 *
 * @returns {Module} The module object.
 */
export function initModule(): Module {
  const scope = Scope.newRootScope();
  const exports = new Map();
  const module = new Module(scope, exports);
  exportCommand(module, "fs", {
    execute: (args: Value[], scope: Scope): Result => {
      const callbackContext: CallbackContext = {
        callback: (args, scope: Scope) => {
          const program = scope.compileArgs(args);
          const process = scope.prepareProcess(program);
          const result = process.run();
          if (result.code == ResultCode.ERROR)
            throw new Error(StringValue.toString(result.value)[1]);
        },
        context: scope,
      };
      return fsCmd.execute(args, callbackContext);
    },
  });
  return module;
}

function exportCommand(module: Module, name, cmd) {
  module.scope.registerNamedCommand(name, cmd);
  module.exports.set(name, STR(name));
}
