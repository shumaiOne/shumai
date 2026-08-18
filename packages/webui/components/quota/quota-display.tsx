import type { ElementType } from 'react'
import type { QuotaResourceTypeEnum } from '@shumai/dtos'
import { formatQuotaPeriod } from '@shumai/dtos'
import { m } from '@/ui/paraglide/messages.js'
import { Cpu, DollarSign, Server, Terminal, Wrench } from 'lucide-react'

/* eslint-disable @typescript-eslint/naming-convention */
export const QUOTA_RESOURCE_META: Record<
  QuotaResourceTypeEnum,
  { label: () => string; icon: ElementType; unit: string }
> = {
  agent_total_tokens: {
    label: () => m.quota_resource_agent_total_tokens(),
    icon: Cpu,
    unit: 'tokens',
  },
  agent_cost: {
    label: () => m.quota_resource_agent_cost(),
    icon: DollarSign,
    unit: '$',
  },
  agent_mcp_call_count: {
    label: () => m.quota_resource_agent_mcp_call_count(),
    icon: Server,
    unit: 'calls',
  },
  agent_bash_call_count: {
    label: () => m.quota_resource_agent_bash_call_count(),
    icon: Terminal,
    unit: 'calls',
  },
  agent_tool_call_count: {
    label: () => m.quota_resource_agent_tool_call_count(),
    icon: Wrench,
    unit: 'calls',
  },
}
/* eslint-enable @typescript-eslint/naming-convention */

export function formatQuotaResourceValue(resource: QuotaResourceTypeEnum, value: number): string {
  if (resource === 'agent_cost') {
    return `$${value.toFixed(2)}`
  }
  return value.toLocaleString()
}

export function getQuotaPeriodLabel(period: string): string {
  switch (formatQuotaPeriod(period)) {
    case '1hour':
      return m.quota_period_1hour()
    case '5hour':
      return m.quota_period_5hour()
    case '1day':
      return m.quota_period_1day()
    case '7day':
      return m.quota_period_7day()
    default:
      return period
  }
}
