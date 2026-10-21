import { describe, expect, it } from 'vitest'
import type { ModelTestResult } from '@common/diagnostics'
import type { TestTask } from '@/pages/model-management/lib/model-test-runner'
import {
  getResultRounds,
  getRoundSuccessRate,
  getTaskDurationLabel,
  getTaskSpeedLabel,
  getTaskStatusClassName,
  getTaskStatusTitle,
  getTaskTokenLabel,
  getTaskTtftLabel,
  getVisibleTestTasks,
  summarizeTestTasks,
} from './results'

/**
 * 结果表的读法。这里每条断言都对应一个**口径**，而不是某个像素：
 * 没量到与测得零是两件事、进度百分比不能是 NaN、失败筛选在失败数归零时自己失效。
 * 这些以前藏在组件里，只有点开面板才看得见。
 */

function result(overrides: Partial<ModelTestResult> = {}): ModelTestResult {
  return {
    modelId: 'm1',
    modelName: 'gpt-4o',
    providerId: 'prov_1',
    providerName: '示例渠道',
    mode: 'streaming',
    success: true,
    durationMilliseconds: 1250,
    ...overrides,
  }
}

function task(overrides: Partial<TestTask> = {}): TestTask {
  return {
    id: 'm1:openai-completions',
    modelId: 'm1',
    modelName: 'gpt-4o',
    providerId: 'prov_1',
    providerName: '示例渠道',
    protocol: 'openai-completions',
    converted: false,
    status: 'queued',
    ...overrides,
  }
}

describe('getResultRounds — 逐轮记录的唯一来源', () => {
  it('服务端给了 rounds 就原样用', () => {
    const rounds = result({
      rounds: [
        { round: 1, success: true, statusCode: 200, durationMilliseconds: 100, outputTokens: 5 },
        { round: 2, success: false, statusCode: 500, durationMilliseconds: 200, errorMessage: 'boom' },
      ],
    }).rounds!
    expect(getResultRounds(result({ rounds }))).toBe(rounds)
  })

  it('老服务端只给总账时，补成「第 1 轮」，字段逐一搬过去', () => {
    const rounds = getResultRounds(result({
      success: false,
      statusCode: 401,
      durationMilliseconds: 900,
      errorMessage: 'unauthorized',
      outputTokens: 0,
      ttftMilliseconds: null,
      tokensPerSecond: null,
    }))
    expect(rounds).toEqual([{
      round: 1,
      success: false,
      statusCode: 401,
      durationMilliseconds: 900,
      errorMessage: 'unauthorized',
      inputTokens: undefined,
      outputTokens: 0,
      ttftMilliseconds: null,
      tokensPerSecond: null,
    }])
  })
})

describe('getRoundSuccessRate', () => {
  it('按整百分比四舍五入', () => {
    expect(getRoundSuccessRate([
      { round: 1, success: true, durationMilliseconds: 1 },
      { round: 2, success: true, durationMilliseconds: 1 },
      { round: 3, success: true, durationMilliseconds: 1 },
    ])).toBe(100)
    expect(getRoundSuccessRate([
      { round: 1, success: true, durationMilliseconds: 1 },
      { round: 2, success: false, durationMilliseconds: 1 },
      { round: 3, success: false, durationMilliseconds: 1 },
    ])).toBe(33)
  })
})

describe('每格的读数：没数据写 —，不补 0', () => {
  it('还没有 result 时四列全写 —', () => {
    const queued = task()
    expect(getTaskTokenLabel(queued)).toBe('—')
    expect(getTaskDurationLabel(queued)).toBe('—')
    expect(getTaskTtftLabel(queued)).toBe('—')
    expect(getTaskSpeedLabel(queued)).toBe('—')
  })

  it('输出 Token 用计数口径：万位以上才折成 k', () => {
    expect(getTaskTokenLabel(task({ result: result({ outputTokens: 9700 }) }))).toBe('9700')
    expect(getTaskTokenLabel(task({ result: result({ outputTokens: 12_340 }) }))).toBe('12.3k')
  })

  it('输出 Token 没上报时写 —，而不是 0', () => {
    expect(getTaskTokenLabel(task({ result: result({ outputTokens: null }) }))).toBe('—')
  })

  it('耗时按毫秒/秒读数', () => {
    expect(getTaskDurationLabel(task({ result: result({ durationMilliseconds: 1250 }) }))).toBe('1.3s')
  })

  it('首字耗时没量到（null）写 —', () => {
    expect(getTaskTtftLabel(task({ result: result({ ttftMilliseconds: null }) }))).toBe('—')
    expect(getTaskTtftLabel(task({ result: result({ ttftMilliseconds: 320 }) }))).toBe('320ms')
  })

  it('速度带单位；没有可比的分母时保持 —，不写成「— t/s」', () => {
    expect(getTaskSpeedLabel(task({ result: result({ tokensPerSecond: 42.4 }) }))).toBe('42 t/s')
    expect(getTaskSpeedLabel(task({ result: result({ tokensPerSecond: 8.25 }) }))).toBe('8.3 t/s')
    expect(getTaskSpeedLabel(task({ result: result({ tokensPerSecond: null }) }))).toBe('—')
  })
})

describe('getTaskStatusTitle — HTTP 码退进悬浮提示', () => {
  it('没有状态码时只给状态词', () => {
    expect(getTaskStatusTitle(task({ result: result() }), '成功')).toBe('成功')
    expect(getTaskStatusTitle(task(), '排队中')).toBe('排队中')
  })

  it('有状态码时补上 HTTP，401 与 429 才能一眼分开', () => {
    expect(getTaskStatusTitle(task({ result: result({ statusCode: 401 }) }), '失败')).toBe('失败 · HTTP 401')
  })
})

describe('getTaskStatusClassName', () => {
  it('四个状态各走一种语义色，排队退到最浅', () => {
    expect(getTaskStatusClassName('success')).toBe('text-text-success')
    expect(getTaskStatusClassName('failed')).toBe('text-text-destructive')
    expect(getTaskStatusClassName('running')).toBe('text-text-primary')
    expect(getTaskStatusClassName('cancelled')).toBe('text-text-tertiary')
    expect(getTaskStatusClassName('queued')).toBe('text-text-quaternary')
  })
})

describe('summarizeTestTasks', () => {
  it('排队与进行中不算已完成，百分比按全部任务算', () => {
    const summary = summarizeTestTasks([
      task({ id: 'a', status: 'success' }),
      task({ id: 'b', status: 'failed' }),
      task({ id: 'c', status: 'cancelled' }),
      task({ id: 'd', status: 'running' }),
    ])
    expect(summary).toEqual({
      successCount: 1,
      failureCount: 1,
      cancelledCount: 1,
      completedCount: 3,
      progress: 75,
    })
  })

  it('没有任务时进度是 0，不是 NaN', () => {
    expect(summarizeTestTasks([]).progress).toBe(0)
  })
})

describe('getVisibleTestTasks', () => {
  const planned = [task({ id: 'a' }), task({ id: 'b' }), task({ id: 'c' })]

  it('还没跑过时显示计划行，分母也是计划数', () => {
    const visible = getVisibleTestTasks([], planned, false)
    expect(visible.tasks).toEqual(planned)
    expect(visible.total).toBe(3)
    expect(visible.failedOnlyActive).toBe(false)
  })

  it('只看失败时只留失败行，但分母仍是全部任务数', () => {
    const tasks = [
      task({ id: 'a', status: 'success' }),
      task({ id: 'b', status: 'failed' }),
      task({ id: 'c', status: 'failed' }),
      task({ id: 'd', status: 'queued' }),
    ]
    const visible = getVisibleTestTasks(tasks, planned, true)
    expect(visible.tasks.map(item => item.id)).toEqual(['b', 'c'])
    expect(visible.total).toBe(4)
    expect(visible.failedOnlyActive).toBe(true)
  })

  it('失败数归零后筛选自动失效，不留一张空白表', () => {
    const tasks = [task({ id: 'a', status: 'success' }), task({ id: 'b', status: 'queued' })]
    const visible = getVisibleTestTasks(tasks, planned, true)
    expect(visible.failedOnlyActive).toBe(false)
    expect(visible.tasks).toHaveLength(2)
  })
})
