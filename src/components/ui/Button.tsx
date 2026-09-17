import type { ButtonHTMLAttributes } from 'react'
import {
  classiBottone,
  type DimensioneBottone,
  type VarianteBottone,
} from './buttonStyles'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: VarianteBottone
  dimensione?: DimensioneBottone
}

export function Button({
  variante = 'secondario',
  dimensione = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return <button type={type} className={classiBottone(variante, dimensione, className)} {...props} />
}
