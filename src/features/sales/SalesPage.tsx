import { useMemo, useState } from 'react';
import { Receipt, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useBranches, useEmployees, useSales } from '@/data/queries';
import type { SaleFilters } from '@/data/adapters/repositories';
import type { Branch, Employee, PaymentMethod, Sale, SaleStatus } from '@/shared/types/domain';
import { useFormatters } from '@/shared/i18n/useFormatters';
import { usePreferences } from '@/shared/stores/preferences';
import { Badge, type BadgeTone } from '@/shared/ui/Badge';
import { Button } from '@/shared/ui/Button';
import { Card } from '@/shared/ui/Card';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { PageHeader } from '@/shared/ui/PageHeader';
import { Skeleton } from '@/shared/ui/Skeleton';
import { inputClass } from '@/shared/ui/Field';

const STATUS_TONE: Record<SaleStatus, BadgeTone> = {
  draft: 'neutral',
  pending_approval: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
  returned: 'info',
};

const STATUS_OPTIONS: SaleStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'rejected',
  'cancelled',
  'returned',
];

const HEADER_CLASS = 'px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-neutral-600';

function employeeName(employee: Employee | undefined, language: 'en' | 'ar'): string {
  if (!employee) return '—';
  return language === 'ar'
    ? `${employee.firstNameAr} ${employee.lastNameAr}`.trim()
    : `${employee.firstName} ${employee.lastName}`.trim();
}

function branchName(branch: Branch | undefined, language: 'en' | 'ar'): string {
  if (!branch) return '—';
  return language === 'ar' ? branch.nameAr : branch.name;
}

export function SalesPage() {
  const { t } = useTranslation();
  const language = usePreferences((state) => state.language);
  const f = useFormatters();

  const [statusFilter, setStatusFilter] = useState<SaleStatus | ''>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [search, setSearch] = useState('');

  const branches = useBranches();
  const employees = useEmployees();

  const filters: SaleFilters = useMemo(
    () => ({
      statuses: statusFilter ? [statusFilter] : undefined,
      branchId: branchFilter || undefined,
      from: fromDate || undefined,
      to: toDate || undefined,
    }),
    [statusFilter, branchFilter, fromDate, toDate]
  );

  const sales = useSales(filters);

  const employeeById = useMemo(() => {
    const map = new Map<string, Employee>();
    (employees.data ?? []).forEach((e) => map.set(e.id, e));
    return map;
  }, [employees.data]);

  const branchById = useMemo(() => {
    const map = new Map<string, Branch>();
    (branches.data ?? []).forEach((b) => map.set(b.id, b));
    return map;
  }, [branches.data]);

  const visibleSales = useMemo(() => {
    const all = sales.data ?? [];
    const term = search.trim().toLowerCase();
    if (!term) return all;
    return all.filter((sale) =>
      [sale.saleNumber, sale.invoiceNumber, sale.notes, employeeName(employeeById.get(sale.employeeId), language)].some(
        (field) => field.toLowerCase().includes(term)
      )
    );
  }, [sales.data, search, employeeById, language]);

  const summary = useMemo(() => {
    const all = sales.data ?? [];
    const approved = all.filter((s) => s.status === 'approved');
    const pending = all.filter((s) => s.status === 'pending_approval');
    return {
      total: approved.reduce((sum, s) => sum + s.netAmount, 0),
      approvedCount: approved.length,
      pendingCount: pending.length,
      count: all.length,
    };
  }, [sales.data]);

  const hasActiveFilters = Boolean(statusFilter || branchFilter || fromDate || toDate);
  const clearFilters = () => {
    setStatusFilter('');
    setBranchFilter('');
    setFromDate('');
    setToDate('');
  };

  const isLoading = sales.isPending || branches.isPending || employees.isPending;
  const isError = sales.isError || branches.isError || employees.isError;
  const hasSales = (sales.data?.length ?? 0) > 0;
  const refetchAll = () => {
    void sales.refetch();
    void branches.refetch();
    void employees.refetch();
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('sales.title')} description={t('sales.description')} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label={t('sales.summary.total')} value={f.money(summary.total)} />
        <SummaryCard label={t('sales.summary.count')} value={f.number(summary.count)} />
        <SummaryCard label={t('sales.summary.approved')} value={f.number(summary.approvedCount)} />
        <SummaryCard label={t('sales.summary.pending')} value={f.number(summary.pendingCount)} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FilterField label={t('sales.filters.status')}>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as SaleStatus | '')}
                className={inputClass}
                aria-label={t('sales.filters.status')}
              >
                <option value="">{t('common.all')}</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {t(`sales.status.${status}`)}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label={t('sales.filters.branch')}>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={inputClass}
                aria-label={t('sales.filters.branch')}
              >
                <option value="">{t('common.all')}</option>
                {(branches.data ?? []).map((b) => (
                  <option key={b.id} value={b.id}>
                    {language === 'ar' ? b.nameAr : b.name}
                  </option>
                ))}
              </select>
            </FilterField>

            <FilterField label={t('sales.filters.from')}>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className={inputClass}
                aria-label={t('sales.filters.from')}
              />
            </FilterField>

            <FilterField label={t('sales.filters.to')}>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className={inputClass}
                aria-label={t('sales.filters.to')}
              />
            </FilterField>
          </div>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              {t('sales.filters.clear')}
            </Button>
          )}
        </div>

        <div className="relative w-full sm:max-w-sm">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('roster.searchPlaceholder')}
            aria-label={t('roster.searchPlaceholder')}
            className={`${inputClass} ps-9`}
          />
        </div>

        {isLoading && <SalesSkeleton />}
        {isError && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <ErrorState onRetry={refetchAll} />
          </div>
        )}
        {!isLoading && !isError && !hasSales && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState
              icon={<Receipt className="h-7 w-7" aria-hidden="true" />}
              title={t('sales.emptyTitle')}
              body={t('sales.emptyBody')}
            />
          </div>
        )}
        {!isLoading && !isError && hasSales && visibleSales.length === 0 && (
          <p className="rounded-2xl border border-neutral-200 bg-white px-6 py-10 text-center text-sm text-neutral-600 shadow-sm">
            {t('sales.noMatches')}
          </p>
        )}
        {!isLoading && !isError && visibleSales.length > 0 && (
          <>
            <p className="text-sm text-neutral-600">{t('sales.count', { count: visibleSales.length })}</p>
            <div className="overflow-x-auto rounded-2xl border border-neutral-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-neutral-200 text-sm">
                <thead className="bg-neutral-50">
                  <tr>
                    <th scope="col" className={HEADER_CLASS}>{t('sales.columns.saleNumber')}</th>
                    <th scope="col" className={HEADER_CLASS}>{t('sales.columns.date')}</th>
                    <th scope="col" className={HEADER_CLASS}>{t('sales.columns.employee')}</th>
                    <th scope="col" className={HEADER_CLASS}>{t('sales.columns.branch')}</th>
                    <th scope="col" className={`${HEADER_CLASS} text-end`}>{t('sales.columns.amount')}</th>
                    <th scope="col" className={HEADER_CLASS}>{t('sales.columns.payment')}</th>
                    <th scope="col" className={HEADER_CLASS}>{t('sales.columns.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {visibleSales.map((sale) => (
                    <SaleRow
                      key={sale.id}
                      sale={sale}
                      employee={employeeById.get(sale.employeeId)}
                      branch={branchById.get(sale.branchId)}
                      language={language}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-primary-900">{value}</p>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-neutral-600">{label}</label>
      {children}
    </div>
  );
}

function SaleRow({
  sale,
  employee,
  branch,
  language,
}: {
  sale: Sale;
  employee?: Employee;
  branch?: Branch;
  language: 'en' | 'ar';
}) {
  const { t } = useTranslation();
  const f = useFormatters();
  return (
    <tr className="transition-colors hover:bg-neutral-50">
      <td className="px-4 py-3 font-mono text-neutral-700" dir="ltr">{sale.saleNumber}</td>
      <td className="px-4 py-3 text-neutral-700">{f.date(sale.saleDate)}</td>
      <td className="px-4 py-3 text-primary-900" dir="auto">{employeeName(employee, language)}</td>
      <td className="px-4 py-3 text-neutral-700">{branchName(branch, language)}</td>
      <td className="px-4 py-3 text-end font-medium tabular-nums text-primary-900">{f.money(sale.netAmount)}</td>
      <td className="px-4 py-3 text-neutral-700">{t(`sales.paymentMethods.${sale.paymentMethod as PaymentMethod}`)}</td>
      <td className="px-4 py-3">
        <Badge tone={STATUS_TONE[sale.status]}>{t(`sales.status.${sale.status}`)}</Badge>
      </td>
    </tr>
  );
}

function SalesSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm" role="status">
      <span className="sr-only">{t('common.loading')}</span>
      {Array.from({ length: 6 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}
