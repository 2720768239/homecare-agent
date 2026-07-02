'use client';

import { useState, useRef, type FormEvent } from 'react';
import { PlusIcon, SendIcon } from '@/components/ui/Icon';

interface ComposerProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (text: string) => void;
  onPlus: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export function Composer({
  value,
  onChange,
  onSubmit,
  onPlus,
  placeholder = '问 HomeCare Agent...',
  disabled,
}: ComposerProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [focused, setFocused] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const text = value.trim();
    if (!text || disabled) return;
    onSubmit(text);
  };

  return (
    <div className="sticky bottom-0 z-20 bg-bg px-[18px] pb-[max(env(safe-area-inset-bottom),12px)] pt-2">
      <form
        onSubmit={submit}
        className="flex h-14 items-center gap-2 rounded-[28px] border border-line bg-bg px-2"
      >
        <button
          type="button"
          onClick={onPlus}
          aria-label="添加资料"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-ink active:scale-95"
        >
          <PlusIcon size={20} />
        </button>
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          disabled={disabled}
          className="h-9 flex-1 resize-none overflow-hidden rounded-[18px] border border-line bg-bg px-4 py-2 text-[15px] leading-5 text-ink outline-none placeholder:text-ink-tertiary disabled:opacity-50"
          style={{ maxHeight: 80 }}
        />
        <button
          type="submit"
          disabled={disabled || !value.trim()}
          aria-label="发送"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95 ${
            value.trim() && !disabled ? 'bg-ink text-white' : 'bg-ink text-white'
          }`}
        >
          <SendIcon size={18} />
        </button>
      </form>
      <p className="sr-only" aria-live="polite">
        {focused ? '输入框已聚焦' : ''}
      </p>
    </div>
  );
}
