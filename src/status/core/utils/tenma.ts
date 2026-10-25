/**
 * 幻世天魔诀 —— 天魔化身状态解析
 *
 * 当主角的状态效果中存在名为「天魔化身：X」的条目时，
 * 状态页以 X（关系列表中的角色）的外貌、等级与五维进行展示。
 */

import type { StatData } from '../types';

/** 化身总时长（分钟），对应技能描述中的 24 小时 */
export const TenmaTotalMinutes = 24 * 60;

/** 进入危险提示的剩余时长（分钟） */
export const TenmaWarningMinutes = 60;

const TenmaEffectPattern = /^\s*天魔化身\s*[：:]\s*(.+?)\s*$/;

type PartnerMap = StatData['关系列表'];
type Partner = PartnerMap[string];

export interface TenmaState {
  /** 状态效果的完整名称 */
  effectName: string;
  /** 化身对象名称 */
  targetName: string;
  /** 化身对象在关系列表中的数据（可能不存在） */
  target?: Partner;
  /** 剩余时间原文 */
  remainingText: string;
  /** 剩余分钟数；无法解析（如战斗中的回合数）时为 null */
  remainingMinutes: number | null;
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
 * 从主角状态效果中找出当前的天魔化身
 */
export const getTenmaState = (
  statusEffects: Record<string, { 剩余时间?: string }> | undefined,
  partners: PartnerMap | undefined,
): TenmaState | null => {
  const entry = _.find(Object.entries(statusEffects ?? {}), ([name]) =>
    TenmaEffectPattern.test(name),
  );
  if (!entry) return null;

  const [effectName, effect] = entry;
  const targetName = effectName.match(TenmaEffectPattern)?.[1] ?? '';
  if (!targetName) return null;

  const remainingText = _.trim(effect?.剩余时间 ?? '');

  return {
    effectName,
    targetName,
    target: partners?.[targetName],
    remainingText,
    remainingMinutes: parseRemainingMinutes(remainingText),
  };
};
