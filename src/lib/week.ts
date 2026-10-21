import { NEXT_WEEK } from '@/config'
import { weekToShow } from '@/core/calendar'
import { nowTime, today } from '@/core/dates'
import type { ProfclickData } from '@/core/model'

/** Il lunedì della settimana da mostrare adesso: dal venerdì sera (o come da .env), quella dopo. */
export function currentWeek(data: ProfclickData) {
  return weekToShow(data, today(), nowTime(), NEXT_WEEK)
}
