import { flagOf } from "@/domain/flag";

/**
 * An athlete's country, written one way everywhere (#948): its flag, or its IOC code in small
 * bold letters when the code has no flag. The caller sizes it and hides it from screen readers.
 */
export function CountryFlag({ code }: { code: string }) {
  return flagOf(code) ?? <span className="text-xs font-bold">{code}</span>;
}
