import type { MachineDisplayType } from "@/lib/machineDisplayTypes";
import { mapDbMachineType } from "@/lib/machineDisplayTypes";
import {
  brazilDateKeyFromTimestamp,
  brazilIsoDate,
  brazilIsoDateLabel,
  brazilLastNDaysRange,
  brazilMonthKeyFromTimestamp,
  brazilMonthLabelFromKey,
  brazilMonthStartIsoDate,
  brazilNormalizeIsoRange,
  brazilWeekLabelFromTimestamp,
  brazilWeekStartIsoFromTimestamp,
} from "@/lib/brazilReportDates";
import { billableRevenueAmount, isManualRelease } from "@/lib/transactionRevenue";

export type SalesPeriodPreset = "today" | "7d" | "month" | "custom";
export type SalesGroupBy = "machine" | "daily" | "weekly" | "monthly";

export interface SalesMachineOption {
  id: string;
  name: string;
  type: string;
}

export interface SalesTransactionRow {
  id: string;
  machine_id: string;
  total_amount: number;
  created_at: string;
  payment_method?: string | null;
  user_id?: string | null;
  operator_name?: string;
  machines?: { name?: string; type?: string } | { name?: string; type?: string }[] | null;
}

export interface SalesReportBucket {
  key: string;
  sortKey: string;
  label: string;
  machineId?: string;
  machineName?: string;
  machineType?: MachineDisplayType;
  sales: number;
  billableSales: number;
  revenue: number;
  manualCount: number;
  manualValue: number;
}

const DB_TYPES: Record<MachineDisplayType, string[]> = {
  lavadora: ["lavadora", "washing", "washer"],
  secadora: ["secadora", "drying", "dryer"],
  massage: ["massage", "poltrona"],
  coffee: ["coffee", "cafe"],
};

export function dbTypesForDisplayType(type: MachineDisplayType): string[] {
  return DB_TYPES[type];
}

export function resolveSalesPeriodRange(
  preset: SalesPeriodPreset,
  customStart: string,
  customEnd: string,
): { start: string; end: string } {
  if (preset === "today") {
    const today = brazilIsoDate();
    return { start: today, end: today };
  }
  if (preset === "7d") {
    return brazilLastNDaysRange(7);
  }
  if (preset === "month") {
    return { start: brazilMonthStartIsoDate(), end: brazilIsoDate() };
  }
  return brazilNormalizeIsoRange(customStart, customEnd);
}

export function machineFromJoin(
  machines: SalesTransactionRow["machines"],
): { name: string; type: string } {
  const row = Array.isArray(machines) ? machines[0] : machines;
  return {
    name: row?.name?.trim() || "Máquina removida",
    type: row?.type || "",
  };
}

export function groupSalesTransactions(
  transactions: SalesTransactionRow[],
  groupBy: SalesGroupBy,
  machines: SalesMachineOption[],
): SalesReportBucket[] {
  if (groupBy === "machine") {
    const byId: Record<string, SalesReportBucket> = {};
    for (const machine of machines) {
      byId[machine.id] = {
        key: machine.id,
        sortKey: `${mapDbMachineType(machine.type)}-${machine.name}`,
        label: machine.name,
        machineId: machine.id,
        machineName: machine.name,
        machineType: mapDbMachineType(machine.type),
        sales: 0,
        billableSales: 0,
        revenue: 0,
        manualCount: 0,
        manualValue: 0,
      };
    }

    for (const tx of transactions) {
      const joined = machineFromJoin(tx.machines);
      const bucket = byId[tx.machine_id] ?? {
        key: tx.machine_id,
        sortKey: `z-${joined.name}`,
        label: joined.name,
        machineId: tx.machine_id,
        machineName: joined.name,
        machineType: mapDbMachineType(joined.type),
        sales: 0,
        billableSales: 0,
        revenue: 0,
        manualCount: 0,
        manualValue: 0,
      };
      addTxToBucket(bucket, tx);
      byId[tx.machine_id] = bucket;
    }

    return Object.values(byId).sort((a, b) => {
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return (a.machineName || "").localeCompare(b.machineName || "", "pt-BR");
    });
  }

  const grouped: Record<string, SalesReportBucket> = {};
  for (const tx of transactions) {
    let key: string;
    let sortKey: string;
    let label: string;
    if (groupBy === "daily") {
      sortKey = brazilIsoDate(new Date(tx.created_at));
      key = sortKey;
      label = brazilDateKeyFromTimestamp(tx.created_at);
    } else if (groupBy === "weekly") {
      sortKey = brazilWeekStartIsoFromTimestamp(tx.created_at);
      key = sortKey;
      label = brazilWeekLabelFromTimestamp(tx.created_at);
    } else {
      sortKey = brazilMonthKeyFromTimestamp(tx.created_at);
      key = sortKey;
      label = brazilMonthLabelFromKey(sortKey);
    }

    if (!grouped[key]) {
      grouped[key] = {
        key,
        sortKey,
        label,
        sales: 0,
        billableSales: 0,
        revenue: 0,
        manualCount: 0,
        manualValue: 0,
      };
    }
    addTxToBucket(grouped[key], tx);
  }

  return Object.values(grouped).sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}

function addTxToBucket(bucket: SalesReportBucket, tx: SalesTransactionRow) {
  bucket.sales += 1;
  bucket.revenue += billableRevenueAmount(tx.total_amount, tx.payment_method);
  if (isManualRelease(tx.payment_method)) {
    bucket.manualCount += 1;
    bucket.manualValue += Number(tx.total_amount) || 0;
  } else {
    bucket.billableSales += 1;
  }
}

export function formatBrl(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function salesPeriodCaption(start: string, end: string): string {
  if (start === end) return brazilIsoDateLabel(start);
  return `${brazilIsoDateLabel(start)} — ${brazilIsoDateLabel(end)}`;
}
