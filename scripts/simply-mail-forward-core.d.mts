export interface SimplyForwardConfiguration {
  domain: string;
  product: string;
  address: string;
  destination: string;
  localpart: string;
}

export function forwardConfiguration(env?: NodeJS.ProcessEnv): SimplyForwardConfiguration;
export function ensureSimplyMailForward(input: {
  config: SimplyForwardConfiguration;
  apiKey: string | undefined;
  apply?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<{ status: "exists" | "created" | "dry-run"; address: string; destination: string }>;
