import { Value } from "./values";

export enum ResultCode {
  OK,
  RETURN,
}
export type Result = [ResultCode, Value];
export interface FlowController {
  interrupt(code: ResultCode, value: Value);
}
export interface Command {
  evaluate(args: Value[], flowController?: FlowController): Value;
}
