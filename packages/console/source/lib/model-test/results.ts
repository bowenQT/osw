import type { ModelTestResult, ModelTestRoundResult } from '@common/diagnostics'
import { formatMilliseconds, formatOutputSpeed, formatTokenCount } from '@common/metrics'
import type { TestTask, TestTaskStatus } from '@/pages/model-management/lib/model-test-runner'

/**
 * 结果表的**读法**：一行结论怎么写、一张表怎么汇总、失败筛选怎么生效。
 *
 * 这些函数原先长在 `components/model-test-panel.tsx` 里。它们看着像「格式化」，
 * 其实全是口径：未测量的首字耗时写 `—` 而不是 `0`、输出速度只在速度诊断里出现、
 * 「只看失败」在失败数归零时自动失效。口径写进渲染文件，就只能靠点开面板去验；
 * 写成纯函数，一个 `expect` 就说得清。
 */

/**
 * 逐轮记录的**唯一来源**：新服务端给 `result.rounds`，老服务端只给一条总账。
 *
 * 两种都要能展开，所以老数据就地补成「第 1 轮」——用同一条渲染路径，不写两套明细表，
 * 也不因为服务端版本不同而让「点开看看」有时有内容、有时空白。
 */
export function getResultRounds(result: ModelTestResult): ModelTestRoundResult[] {
  if (result.rounds?.length) return result.rounds
  return [{
    round: 1,
    success: result.success,
    statusCode: result.statusCode,
    durationMilliseconds: result.durationMilliseconds,
    errorMessage: result.errorMessage,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    ttftMilliseconds: result.ttftMilliseconds,
    tokensPerSecond: result.tokensPerSecond,
  }]
}

/** 成功率按整百分比四舍五入：明细里印的是「3/4 · 75%」，不是小数。 */
export function getRoundSuccessRate(rounds: readonly ModelTestRoundResult[]): number {
  const successCount = rounds.filter(round => round.success).length
  return Math.round((successCount / rounds.length) * 100)
}

/**
 * 输出列只放**上游报出来的输出 Token**。
 *
 * 没报就是没报：写 `—`，不补一个 `0`——「上游没说」和「一个字都没出」是两件事，
 * 按 0 展示会把前者算进后者的口径里。输出速度列的分母与它同源，两列并排读得通。
 */
export function getTaskTokenLabel(task: TestTask): string {
  return task.result ? formatTokenCount(task.result.outputTokens) : '—'
}

export function getTaskDurationLabel(task: TestTask): string {
  return task.result ? formatMilliseconds(task.result.durationMilliseconds) : '—'
}

/** 首字耗时只量得到流式：整包响应里没有「第一块」这个时刻，没量到就写 `—`，不编一个 0。 */
export function getTaskTtftLabel(task: TestTask): string {
  return task.result ? formatMilliseconds(task.result.ttftMilliseconds) : '—'
}

/** 出字速度只有速度诊断会给：其余模式里分母是两个数减出来的，宁缺勿编。 */
export function getTaskSpeedLabel(task: TestTask): string {
  if (!task.result) return '—'
  const speed = formatOutputSpeed(task.result.tokensPerSecond)
  return speed === '—' ? '—' : `${speed} t/s`
}

/** 状态词的配色：成功绿、失败红、进行中主文色、取消与排队退到灰。 */
export function getTaskStatusClassName(status: TestTaskStatus): string {
  if (status === 'success') return 'text-text-success'
  if (status === 'failed') return 'text-text-destructive'
  if (status === 'running') return 'text-text-primary'
  if (status === 'cancelled') return 'text-text-tertiary'
  return 'text-text-quaternary'
}

/**
 * 状态格的 `title`：把「上游到底回了什么」补上。
 *
 * 格子里只印短短的「失败」，因为状态列要能一眼竖着扫下来；HTTP 码是查错时的第一手
 * 线索（401 与 429 的处置完全不同），所以它退到悬浮提示里，不占列宽。
 * 错误原文本来就在行下方那条红框里，不必在这里再抄一遍。
 */
export function getTaskStatusTitle(task: TestTask, statusLabel: string): string {
  if (!task.result?.statusCode) return statusLabel
  return `${statusLabel} · HTTP ${task.result.statusCode}`
}

export interface TestTaskSummary {
  successCount: number
  failureCount: number
  cancelledCount: number
  /** 已经有结局的行数（成功 + 失败 + 取消）。排队中与进行中都不算。 */
  completedCount: number
  /** 0–100 的整数百分比；还没有任务时是 0，不是 NaN。 */
  progress: number
}

/** 一行一个计数，全部从同一份任务列表推导，避免「进度条 80% 但成功数 0」这类对不上。 */
export function summarizeTestTasks(tasks: readonly TestTask[]): TestTaskSummary {
  const successCount = tasks.filter(task => task.status === 'success').length
  const failureCount = tasks.filter(task => task.status === 'failed').length
  const cancelledCount = tasks.filter(task => task.status === 'cancelled').length
  const completedCount = successCount + failureCount + cancelledCount
  return {
    successCount,
    failureCount,
    cancelledCount,
    completedCount,
    progress: tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100),
  }
}

export interface VisibleTestTasks {
  tasks: readonly TestTask[]
  /** 分母：有结果时是全部任务数，还没开跑时是计划任务数。它**不跟随筛选**。 */
  total: number
  /** 「只看失败」是否真的生效。 */
  failedOnlyActive: boolean
}

/**
 * 结果表当前应该渲染哪些行。
 *
 * 还没跑过时显示计划（每一行都是排队态），跑过之后显示结论。筛选是否生效是**推导**出来的：
 * 重测成功后失败数归零，此时不能再停留在「只看失败」上——否则表格会空白，而失败行
 * 其实已经变绿了。所以它不写回 state。
 */
export function getVisibleTestTasks(tasks: readonly TestTask[], plannedTasks: readonly TestTask[], failedOnly: boolean): VisibleTestTasks {
  const failureCount = tasks.filter(task => task.status === 'failed').length
  const failedOnlyActive = failedOnly && failureCount > 0
  const hasResults = tasks.length > 0
  return {
    tasks: hasResults
      ? (failedOnlyActive ? tasks.filter(task => task.status === 'failed') : tasks)
      : plannedTasks,
    total: hasResults ? tasks.length : plannedTasks.length,
    failedOnlyActive,
  }
}
