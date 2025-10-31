import Vapi from "@vapi-ai/web";

let vapiInstance: Vapi | null = null;

export function getVapiClient(): Vapi {
  if (!vapiInstance) {
    const publicKey = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error("VAPI public key is not configured");
    }
    vapiInstance = new Vapi(publicKey);
  }
  return vapiInstance;
}

export function destroyVapiClient() {
  if (vapiInstance) {
    vapiInstance.stop();
    vapiInstance = null;
  }
}
