import { cn } from '@/lib/utils'

/**
 * 卡片里的一枚**紧凑指标格**：只有两行，标签 + 数值。
 *
 * 它与 `metric-grid.tsx` 的 `MetricGrid` 不是同一种东西，两者也不该合并：
 * `MetricGrid` 是页面顶部的**总览卡**，一格占一张卡、数值用 `system-xl-semibold`，
 * 读法是「先扫四张大数字」；这里的格子是**详情卡内部的嵌套模块**，数值只有
 * `system-md-medium`、标签是小号大写，读法是「在一张卡里并排比对一串读数」。
 * 把总览卡的尺寸搬进详情，展开区会立刻比它所属的那一行更重。
 *
 * 只有两行，不加第三行补充说明：「缓存是否命中」这类上下文在各自的原始数据里
 * 都已有落点，在数值底下再写一遍只会稀释数字本身。空值走最淡的一档灰，
 * 让有数字的格子自己浮出来。
 *
 * **用一层底色，不用描边。** 一枚 1px 的框要画四条边，一排六枚就是二十四条细线；
 * 凑在一起时读者先看到的是网格，不是数字。换成一档填色之后，格子与格子之间只靠
 * 留白分开，读数自己成为画面里唯一有密度的地方——与协议槽
 * （`PROTOCOL_TRACK_CLASS`）同一条理由。
 *
 * 填色用 `bg-workflow-block-parma-bg` 而不是 `bg-inset`：这两个令牌在亮色下近似同色
 * （#f2f4f7 / #ebedf0），但在暗色里方向相反——`parma` 是卡面**之上**的一层
 * （`rgb(255 255 255 / .05)`），凹槽是卡面**之下**的一层（5%）。同一块放在 `bg-card`
 * 上，前者读作「抬起的芯片」，后者读作「整张卡被挖了六个洞」。详情卡是抬起来读的，
 * 所以用前者。
 */
export interface MetricCardProps {
  label: string
  value: string
  /**
   * 数值的语义色，只在「这个数的好坏本身就是结论」时用（例如成功率没到 100%）。
   *
   * 大部分指标不带色调：一排五颜六色的读数里，真正需要被注意的那格反而浮不出来。
   * 空值一律走最淡的灰，**穿不过**这里的色调——`—` 不是「坏」，是「没测到」。
   */
  tone?: 'default' | 'success' | 'destructive'
}

const TONE_CLASS_NAMES: Record<NonNullable<MetricCardProps['tone']>, string> = {
  default: 'text-text-primary',
  success: 'text-text-success',
  destructive: 'text-text-destructive',
}

export function MetricCard(props: MetricCardProps) {
  const empty = props.value === '—'

  return (
    <div data-slot="metric-card" className="w-26 shrink-0 rounded-md bg-workflow-block-parma-bg px-2.5 py-1.5">
      <div className="system-2xs-medium-uppercase text-text-tertiary">{props.label}</div>
      <div
        className={cn(
          'mt-0.5 truncate font-mono system-sm-medium tabular-nums',
          empty ? 'text-text-quaternary' : TONE_CLASS_NAMES[props.tone ?? 'default'],
        )}
      >
        {props.value}
      </div>
    </div>
  )
}

/**
 * 装一排指标格的容器。
 *
 * 固定宽 + `flex-wrap`，不用 `grid` + `1fr`：`1fr` 一定会把每格拉到把整行填满，
 * 六个读数摊在一米宽的面板上，值就漂到格子另一头，与自己的标签分开——那就不再是
 * 一枚「格子」，而是一条灰带。宽度钉死在 104px 后，一排六枚只占左边一小段，
 * 剩下的横向空间留给下面的轮次表。
 *
 * 一条只有两行小字的格子不需要更宽：104px 刚好装下 `12.3k` 与「输出 Token」
 * （最长的那个标签），再宽也只是把留白撑开。窄容器里排不下时自动换行，
 * 不挤也不截断。
 *
 * 宽度写在两处会分岔（格子自己一个宽、外层轨道另一个宽），所以容器只管间距，
 * 宽度由 `MetricCard` 自己负责。
 */
export const METRIC_CARD_GRID_CLASS = 'flex flex-wrap gap-1.5'
