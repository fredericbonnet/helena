/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { STR } from "../../core/values";
import { Scope } from "../../helena-dialect/core";
import { Module } from "../../helena-dialect/modules";
import { childProcessCmd } from "./child_process";

/**
 * Main dynamic module entry point.
 *
 * @returns {Module} The module object.
 */
export function initModule(): Module {
  const scope = Scope.newRootScope();
  const exports = new Map();
  const module = new Module(scope, exports);
  exportCommand(module, "child_process", childProcessCmd);
  return module;
}

function exportCommand(module: Module, name, cmd) {
  module.scope.registerNamedCommand(name, cmd);
  module.exports.set(name, STR(name));
}
