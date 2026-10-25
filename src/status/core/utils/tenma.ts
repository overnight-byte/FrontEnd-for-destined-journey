/**
 * 幻世天魔诀 —— 天魔化身 / 天魔附身状态解析
 *
 * - 「天魔化身：X」：限时变身（同一时间只有一个，新的覆盖旧的）
 * - 「天魔附身：X」：可层层叠加，层数越大越外层；效果中注明「躯体已死」者，
 *   主角离开时该身体即倒下
 *
 * 面板显示主角「当前的外表」：有化身时为化身对象，否则为最外层的附身对象。
 */

import type { StatData } from '../types';

/** 化身总时长（分钟），对应技能描述中的 24 小时 */
export const TenmaTotalMinutes = 24 * 60;

/** 进入危险提示的剩余时长（分钟） */
export const TenmaWarningMinutes = 60;

const TenmaEffectPattern = /^\s*天魔(化身|附身)\s*[：:]\s*(.+?)\s*$/;
const TenmaDeadPattern = /躯体已死|軀體已死|躯壳已死|軀殼已死/;

/** transform = 限时化身；possess = 附身（无时限，直至主角离开） */
export type TenmaMode = 'transform' | 'possess';

export const TenmaModeLabel: Record<TenmaMode, string> = {
  transform: '化身',
  possess: '附身',
};

type PartnerMap = StatData['关系列表'];
type Partner = PartnerMap[string];

type TenmaEffectLike = {
  剩余时间?: string;
  层数?: number;
  效果?: string;
  来源?: string;
};

export interface TenmaPossessionLayer {
  /** 被附身者名称 */
  name: string;
  /** 层数（越大越外层） */
  layer: number;
  /** 该身体是否已被杀死（仅靠天魔诀维持） */
  dead: boolean;
}

export interface TenmaState {
  /** 当前外表来自化身还是附身 */
  mode: TenmaMode;
  /** 状态效果的完整名称 */
  effectName: string;
  /** 当前外表对象名称 */
  targetName: string;
  /** 当前外表对象在关系列表中的数据（可能不存在） */
  target?: Partner;
  /** 剩余时间原文 */
  remainingText: string;
  /** 剩余分钟数；附身或无法解析（如战斗中的回合数）时为 null */
  remainingMinutes: number | null;
  /** 附身层（由内到外），没有附身时为空数组 */
  possessions: TenmaPossessionLayer[];
}

/**
 * 将「12小时30分」「1天2小时」「45分钟」等文本解析为分钟数
 */
export const parseRemainingMinutes = (text: string): number | null => {
  const source = _.trim(text || '');
  if (!source) return null;

  const units: Array<[RegExp, number]> = [
    [/(\d+(?:\.\d+)?)\s*(?:天|日)/, 24 * 60],
    [/(\d+(?:\.\d+)?)\s*(?:小时|小時|时|時|h)/i, 60],
    [/(\d+(?:\.\d+)?)\s*(?:分钟|分鐘|分|min|m)(?!s)/i, 1],
  ];

  let matched = false;
  let total = 0;
  units.forEach(([pattern, factor]) => {
    const match = source.match(pattern);
    if (match) {
      matched = true;
      total += Number(match[1]) * factor;
    }
  });

  return matched ? Math.max(0, Math.round(total)) : null;
};

/**
 * 从主角状态效果中解析天魔化身 / 附身
 */
export const getTenmaState = (
  statusEffects: Record<string, TenmaEffectLike> | undefined,
  partners: PartnerMap | undefined,
): TenmaState | null => {
  const parsed = Object.entries(statusEffects ?? {})
    .map(([effectName, effect], index) => {
      const match = effectName.match(TenmaEffectPattern);
      if (!match || !match[2]) return null;
      return {
        effectName,
        effect: effect ?? {},
        mode: (match[1] === '附身' ? 'possess' : 'transform') as TenmaMode,
        targetName: match[2],
        index,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (parsed.length === 0) return null;

  // 附身层：按层数由内到外排序，层数相同则按出现顺序
  const possessionEntries = _.sortBy(
    parsed.filter(item => item.mode === 'possess'),
    item => Number(item.effect.层数) || 0,
    item => item.index,
  );
  const possessions: TenmaPossessionLayer[] = possessionEntries.map((item, idx) => ({
    name: item.targetName,
    layer: Number(item.effect.层数) || idx + 1,
    dead: TenmaDeadPattern.test(`${item.effect.效果 ?? ''} ${item.effect.来源 ?? ''}`),
  }));

  // 当前外表：化身覆盖附身；多个化身时取最后一个（新的覆盖旧的）
  const transform = _.findLast(parsed, item => item.mode === 'transform');
  const shown = transform ?? _.last(possessionEntries);
  if (!shown) return null;

  const remainingText = _.trim(shown.effect.剩余时间 ?? '');

  return {
    mode: shown.mode,
    effectName: shown.effectName,
    targetName: shown.targetName,
    target: partners?.[shown.targetName],
    remainingText,
    remainingMinutes: shown.mode === 'possess' ? null : parseRemainingMinutes(remainingText),
    possessions,
  };
};
