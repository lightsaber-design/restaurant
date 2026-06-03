import { appConfig } from "../config";

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code = "API_ERROR") {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith("/") ? `${appConfig.api.baseUrl}${path}` : path;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
      },
      signal: controller.signal,
    });

    const body = (await response.json().catch(() => ({}))) as { code?: string; message?: string };
    if (!response.ok) {
      throw new ApiError(body.message || "La solicitud falló.", response.status, body.code);
    }

    return body as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("La solicitud tardó demasiado.", 408, "REQUEST_TIMEOUT");
    }
    throw new ApiError("Falló la conexión de red.", 0, "NETWORK_ERROR");
  } finally {
    clearTimeout(timeoutId);
  }
}
