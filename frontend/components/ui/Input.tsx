import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

const fieldClasses =
  'w-full rounded-card border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:bg-gray-50';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={clsx(fieldClasses, className)} {...props} />
  ),
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={clsx(fieldClasses, 'min-h-[120px]', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-gray-700">
      {children}
    </label>
  );
}
