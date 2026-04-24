import { type } from "arktype";

export const BearerToken = type("string>=32");
export type BearerToken = typeof BearerToken.infer;

export const PortNumber = type("number.integer>=1024<=65535");
export type PortNumber = typeof PortNumber.infer;

export type ServerState =
  | { status: "stopped" }
  | { status: "starting" }
  | { status: "listening"; port: PortNumber }
  | { status: "error"; error: string };
