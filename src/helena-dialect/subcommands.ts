/* eslint-disable jsdoc/require-jsdoc */ // TODO
import { ERROR, Result } from "../core/results";
import { LIST, ListValue, STR, Value } from "../core/values";

export class Subcommands {
  readonly list: ListValue;
  constructor(names: string[]) {
    this.list = LIST(names.map((name) => STR(name)));
  }
  unknown(subcommand: string) {
    if (subcommand == null) return "invalid subcommand name";
    return `unknown subcommand "${subcommand}"`;
  }
  dispatch(
    subcommand: Value,
    handlers: { [name: string]: () => Result }
  ): Result {
    const name = subcommand.asString?.();
    if (!handlers[name]) return ERROR(this.unknown(name));
    return handlers[name]();
  }
}
