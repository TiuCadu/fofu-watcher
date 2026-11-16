import { errorText } from './i18n';
import type { Translate } from './time';
import type { CheckNowResponse } from './types';

export interface CheckMessage { text: string; detail?: string; isError: boolean }

export function describeCheckResult(r: CheckNowResponse | undefined, t: Translate): CheckMessage {
  if (!r) return { text: t('checkFailed', { error: errorText(t, { key: 'errNoAnswer' }) }), isError: true };
  if (!r.ok) return { text: t('checkFailed', { error: errorText(t, { key: 'errUnexpected', params: { message: r.error } }) }), isError: true };
  const { outcome, error, info } = r.result;
  const detail = info ? t('checkDetail', { chars: info.chars.toLocaleString(), hash: info.hash }) : undefined;
  switch (outcome) {
    case 'baseline': return { text: t('checkBaseline'), detail, isError: false };
    case 'unchanged': return { text: t('checkUnchanged'), detail, isError: false };
    case 'changed': return { text: t('checkChanged'), detail, isError: false };
    default: return { text: t('checkFailed', { error: errorText(t, error ?? null) }), isError: true };
  }
}
