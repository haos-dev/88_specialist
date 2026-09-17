import type { HTMLAttributes, ReactNode, ThHTMLAttributes, TdHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/**
 * Tabelle a filetti: nessuna zebratura, nessuna ombra, nessun bordo esterno.
 * È il registro cartaceo di allenamento, non una griglia di card.
 */

export function Table({
  children,
  className,
  ...props
}: HTMLAttributes<HTMLTableElement> & { children: ReactNode }) {
  return (
    <div className="-mx-1 overflow-x-auto px-1">
      <table className={cn('w-full border-collapse text-left', className)} {...props}>
        {children}
      </table>
    </div>
  )
}

export function TH({ className, children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={cn(
        'border-b border-line-strong pb-1.5 pr-4 text-xs font-medium text-muted last:pr-0',
        className,
      )}
      {...props}
    >
      {children}
    </th>
  )
}

export function TD({ className, children, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-b border-line py-2.5 pr-4 align-middle last:pr-0', className)} {...props}>
      {children}
    </td>
  )
}

export function TR({
  className,
  children,
  interattiva = false,
  ...props
}: HTMLAttributes<HTMLTableRowElement> & { interattiva?: boolean }) {
  return (
    <tr
      className={cn(interattiva && 'cursor-pointer transition-colors hover:bg-teal-soft/55', className)}
      {...props}
    >
      {children}
    </tr>
  )
}
