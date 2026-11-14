import { UseCaseError } from "@/application/errors";

/**
 * A page block read on its own: when its use case fails, the page keeps the other blocks, shows
 * the fallback here, and the server log names the read and the error code (#763).
 */
export async function readOr<T, F>(label: string, read: Promise<T>, fallback: F): Promise<T | F> {
  try {
    return await read;
  } catch (error) {
    if (!(error instanceof UseCaseError)) throw error;
    console.error(`read failed: ${label} ${error.code}`);
    return fallback;
  }
}
