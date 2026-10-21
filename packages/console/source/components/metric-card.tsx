import { cn } from '@/lib/utils'

/**
 * 卡片里的一枚**紧凑指标格**：只有两行，标签 + 数值。
 *
 * 它与 `metric-grid.tsx` 的 `MetricGrid` 不是同一种东西，两者也不该合并：
 * `MetricGrid` 是页面顶部的**总览卡**，一格占一张卡、数值用 `system-xl-semibold`，
 * 读法是「先扫四张大数字」；这里的格子是**详情卡内部的嵌套模块**，数值只有
 * `system-sm-medium`、标签是小号大写，读法是「在一张卡里并排比对一串读数」。
 * 把总览卡的尺寸搬进详情，展开区会立刻比它所属的那一行更重。
 *
 * 只有两行，不加第三行补充说明：「缓存是否命中」这类上下文在各自的原始数据里
 * 都已有落点，在数值底下再写一遍只会稀释数字本身。空值走最淡的一档灰，
 * 让有数字的格子自己浮出来。
 *
 * **用一条竖线把自己和前一列隔开，不用底色、也不用四边围框。**
 *
 * 三条路都试过了：描一圈 1px 的框，一排六枚就是二十四条细线，读者先看到的是网格；
 * 每枚格子铺一块灰底，展开区本来就在白卡里，再铺一层就是一整片灰——这正是「灰灰的
 * 背景」被讨厌的原因；把灰底上提到容器做成通栏底带更糟，格子只有左边一段时右端会
 * 拖出一段没内容的灰（实测容器 746px、六枚 96px 格子共 680px）。
 *
 * 留下的是「只有列间一条线」：线条没有消失，而是只画在读者真需要分界的地方。
 * 六枚读数是一条横向数据的六列，竖线就是列与列的语言；横向上不需要边界（容器
 * 对齐已经说明开始了），于是首列不画线。层次交给排版：标签 11px 大写灰、
 * 值 13px 等宽深色。
 */

/** 一枚格子的宽度：装得下最长的标签（「输出 Token」）与最长的值（`12.3k`）。 */
const METRIC_CARD_CLASS = 'min-w-24 shrink-0 border-l border-border pl-3 first:border-l-0 first:pl-0'
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
    <div data-slot="metric-card" className={METRIC_CARD_CLASS}>
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
 * 装一排指标格的容器：**只排行距，横向上不进任何背景**。
 *
 * 列间的线由格子自己的 `border-l` 画（见 `METRIC_CARD_CLASS`）——这一点很关键：
 * 线条归属格子，就能跟着格子走。容器一旦自己铺底或描边，格子排不满时右边会
 * 拖出一段空白的灰带或一条多出来的框。
 *
 * 固定宽 + `flex-wrap`，不用 `grid` + `1fr`：`1fr` 会把每格拉到填满整行，六个读数
 * 摊在一米宽的面板上，值就漂到格子另一头、与自己的标签分开。96px 起跳刚好装下
 * `12.3k` 与「输出 Token」（最长的那个标签），一排六枚只占左边一小段；窄容器里
 * 自动换行——换行后第二行首列会留下一条前导线，这是对的：那一行确实是在接着
 * 上一行的列往下排，线不该在这里断掉。
 */
export const METRIC_CARD_GRID_CLASS = 'flex flex-wrap gap-y-3'
