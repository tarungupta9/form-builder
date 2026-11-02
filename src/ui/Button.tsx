import type { ButtonHTMLAttributes, ReactNode, Ref } from 'react';
import { Link, type LinkProps } from 'react-router';
import styles from './Button.module.css';
import { Icon, type IconName } from './icons';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'dangerQuiet' | 'dashed';
export type ButtonSize = 'md' | 'sm' | 'lg';

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  children: ReactNode;
}

export function buttonClassName(
  variant: ButtonVariant = 'secondary',
  size: ButtonSize = 'md',
  extra?: string,
) {
  return [styles.button, styles[variant], styles[size], extra].filter(Boolean).join(' ');
}

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean };

/**
 * A native `<button>`. `busy` keeps the button focusable and announces the state through
 * `aria-busy`, rather than disabling it and dropping focus while work is in progress.
 */
export function Button({
  variant,
  size,
  icon,
  busy = false,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-busy={busy || undefined}
      className={buttonClassName(variant, size, className)}
    >
      {busy ? <Icon name="spinner" className={styles.spinner} /> : icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

type ButtonLinkProps = CommonProps & LinkProps;

/** Navigation styled as a button. It stays a link, so it opens in a new tab and reads as a link. */
export function ButtonLink({ variant, size, icon, children, className, ...rest }: ButtonLinkProps) {
  return (
    <Link {...rest} className={buttonClassName(variant, size, className)}>
      {icon && <Icon name={icon} />}
      {children}
    </Link>
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: IconName;
  /** Required: an icon-only button has no other accessible name. */
  label: string;
  /** For a caller that moves focus back to the button, as a menu does when it closes. */
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({ icon, label, className, type = 'button', ...rest }: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={label}
      className={[styles.iconButton, className].filter(Boolean).join(' ')}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}
