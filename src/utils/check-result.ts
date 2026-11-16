import { errorText } from './i18n';
import type { Translate } from './time';
import type { CheckNowResponse } from './types';

export function describeCheckResult(r: CheckNowResponse | undefined, t: Translate): { text: string; isError: boolean } {
  if (!r) return { text: t('checkFailed', { error: errorText(t, { key: 'errNoAnswer' }) }), isError: true };
  if (!r.ok) return { text: t('checkFailed', { error: errorText(t, { key: 'errUnexpected', params: { message: r.error } }) }), isError: true };
  switch (r.result.outcome) {
    case 'baseline': return { text: t('checkBaseline'), isError: false };
    case 'unchanged': return { text: t('checkUnchanged'), isError: false };
    case 'changed': return { text: t('checkChanged'), isError: false };
    default: return { text: t('checkFailed', { error: errorText(t, r.result.error ?? null) }), isError: true };
  }
}
