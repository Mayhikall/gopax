import { API_URL } from "@/lib/web3/config";
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
  }
}
export async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string,
): Promise<T> {
  if (!API_URL || !/^https?:\/\//.test(API_URL))
    throw new ApiError(
      "The API connection is not configured. Set NEXT_PUBLIC_API_URL to connect Gopax.",
      503,
      "API_NOT_CONFIGURED",
    );
  const response = await fetch(API_URL + path, {
    ...options,
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "The server returned an unreadable response. Please try again.",
      response.status,
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error ||
        data.errors?.map((e: { msg: string }) => e.msg).join(" ") ||
        "Something went wrong. Please try again.",
      response.status,
      data.code,
    );
  return data as T;
}
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  const e = error as { shortMessage?: string; message?: string; code?: number };
  if (e?.code === 4001 || /rejected|denied/i.test(e?.message || ""))
    return "Request cancelled in your wallet. You can try again.";
  return (
    e?.shortMessage ||
    "Unable to complete this request. Check your connection and try again."
  );
}
