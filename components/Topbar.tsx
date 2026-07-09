export function Topbar({
  breadcrumb,
  rightSlot,
  inicial
}: {
  breadcrumb: string;
  rightSlot?: React.ReactNode;
  inicial: string;
}) {
  return (
    <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-white shrink-0">
      <div className="text-sm text-inkSoft">{breadcrumb}</div>
      <div className="flex items-center gap-2.5">
        {rightSlot}
        <div className="w-8 h-8 rounded-full bg-navy text-white font-bold text-xs flex items-center justify-center">
          {inicial}
        </div>
      </div>
    </div>
  );
}
