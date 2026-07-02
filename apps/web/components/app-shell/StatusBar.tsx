'use client';

export function StatusBar() {
  return (
    <div className="ios-status-bar" aria-hidden="true">
      <span>9:41</span>
      <span className="h-[26px] w-[82px] rounded-2xl bg-ink" />
      <span className="flex items-center gap-2">
        <span className="ios-signal-bars">
          <span className="h-[5px]" />
          <span className="h-2" />
          <span className="h-[11px]" />
        </span>
        <span className="relative h-3 w-[25px]">
          <span className="absolute left-0 top-0 h-[10px] w-[22px] rounded-sm border-[1.4px] border-ink" />
          <span className="absolute right-0 top-[3px] h-1 w-0.5 rounded-[1px] bg-ink" />
          <span className="absolute left-1 top-[3px] h-1 w-3 rounded-[1px] bg-ink" />
        </span>
      </span>
    </div>
  );
}
