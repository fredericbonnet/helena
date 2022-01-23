import { Value } from "./values";

export interface Command {
  evaluate(args: Value[]): Value;
}
