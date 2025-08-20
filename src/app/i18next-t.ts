// Import from our simplified i18n module instead of i18next
import { t as simpleT } from './i18n';

export type I18nKey = string;

export const t = (
  key: I18nKey,
  opts?:
    | { count?: number; context?: string; metadata?: { context?: string[]; keys?: string } }
    | {
        [arg: string]: number | string;
      },
): string => simpleT(key, opts);

/**
 * This is a "marker function" that tells our i18next-scanner that you will translate this string later (tl = translate later).
 * This way you don't need to pre-translate everything or include redundant comments. This function is inlined and
 * has no runtime presence.
 */
/*@__INLINE__*/
export function tl<T extends I18nKey>(key: T): T {
  return key;
}
