import { useEffect, useState } from 'react';

export interface OnboardingTask {
  key: string;
  icon: string;
  label: string;
  done: boolean;
}

interface Props {
  tasks: OnboardingTask[];
  allDone: boolean;
  onAllDone: () => void; // 全部完成后调用，用于设置"已完成引导"标记并隐藏组件
}

/**
 * 首次使用新手任务引导。目标：让新用户在第一次会话里，被动地走完
 * "探索→查看→收集"这条核心价值路径，并在完成时给一个有仪式感的反馈——
 * 提升"首轮使用率"（新用户第一次打开就能感受到产品的核心乐趣）。
 */
export function OnboardingGuide({ tasks, allDone, onAllDone }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const doneCount = tasks.filter((t) => t.done).length;

  useEffect(() => {
    if (!allDone) return;
    setShowCelebration(true);
    const t = setTimeout(() => {
      setShowCelebration(false);
      onAllDone();
    }, 2400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allDone]);

  if (showCelebration) {
    return (
      <div className="onboarding-celebration">
        <div className="onboarding-celebration-inner">
          <div className="onboarding-celebration-icon">🎉</div>
          <div className="onboarding-celebration-title">新手任务全部完成！</div>
          <div className="onboarding-celebration-badge">🌱 自然新手</div>
          <div className="onboarding-celebration-sub">你已经掌握了探索、查看与收集的核心玩法～</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`onboarding-guide ${collapsed ? 'collapsed' : ''}`}>
      <div className="onboarding-guide-header" onClick={() => setCollapsed((v) => !v)}>
        <span>🎯 新手任务 {doneCount}/{tasks.length}</span>
        <span className="onboarding-guide-toggle">{collapsed ? '▾' : '▴'}</span>
      </div>
      {!collapsed && (
        <div className="onboarding-guide-list">
          {tasks.map((t) => (
            <div key={t.key} className={`onboarding-task ${t.done ? 'done' : ''}`}>
              <span className="onboarding-task-check">{t.done ? '✅' : '⬜'}</span>
              <span className="onboarding-task-icon">{t.icon}</span>
              <span className="onboarding-task-label">{t.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
