/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { idemCmd, returnCmd, yieldCmd } from "./basic-commands";
import { macroCmd } from "./macros";
import { Scope } from "./core";
import { letCmd, setCmd, getCmd } from "./variables";
import { scopeCmd } from "./scopes";
import { closureCmd } from "./closures";

export { Scope, Variable, CommandValue } from "./core";

export function initCommands(scope: Scope) {
  scope.commands.set("idem", idemCmd);
  scope.commands.set("return", returnCmd);
  scope.commands.set("yield", yieldCmd);

  scope.commands.set("let", letCmd);
  scope.commands.set("set", setCmd);
  scope.commands.set("get", getCmd);

  scope.commands.set("scope", scopeCmd);

  scope.commands.set("macro", macroCmd);
  scope.commands.set("closure", closureCmd);
}
