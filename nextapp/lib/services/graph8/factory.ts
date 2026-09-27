/** Ported from backend/app/services/graph8/factory.py */
import { prisma } from "../../db";
import { settings } from "../../config";
import { decryptSecret } from "../../secrets";
import { DemoGraph8Provider } from "./demoProvider";
import { LiveGraph8Provider } from "./liveProvider";
import type { Graph8Provider } from "./base";

const demoSingleton = new DemoGraph8Provider();

export async function getProviderForOrg(organizationId: string): Promise<Graph8Provider> {
  const connection = await prisma.graph8Connection.findUnique({ where: { organizationId } });
  let apiKey: string | null = null;
  if (connection?.encryptedApiKeyRef) {
    apiKey = decryptSecret(connection.encryptedApiKeyRef);
  }
  return getGraph8Provider(apiKey);
}

export function getGraph8Provider(apiKey?: string | null): Graph8Provider {
  const key = apiKey || settings.graph8ApiKey;
  if (key) return new LiveGraph8Provider(key);
  return demoSingleton;
}
