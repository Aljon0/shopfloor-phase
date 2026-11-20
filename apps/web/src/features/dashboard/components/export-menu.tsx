import { ChevronDown, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { downloadCsv } from '@/lib/csv'
import type { DashboardData } from '../lib/aggregate'
import { buildDailyCsv, buildDowntimeCsv, buildLinePerformanceCsv, type CsvExport } from '../lib/export'

interface ExportMenuProps {
  data: DashboardData | undefined
}

const EXPORTS: { label: string; build: (data: DashboardData) => CsvExport }[] = [
  { label: 'Daily summary', build: buildDailyCsv },
  { label: 'Line performance', build: buildLinePerformanceCsv },
  { label: 'Downtime by category', build: buildDowntimeCsv },
]

export function ExportMenu({ data }: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" disabled={!data}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
          <ChevronDown className="h-4 w-4 text-muted" aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Selected period, as shown</DropdownMenuLabel>
        {EXPORTS.map(({ label, build }) => (
          <DropdownMenuItem
            key={label}
            onSelect={() => {
              if (!data) return
              const { filename, csv } = build(data)
              downloadCsv(filename, csv)
            }}
          >
            {label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
