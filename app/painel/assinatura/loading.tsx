export default function AssinaturaLoading() {
  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl animate-pulse space-y-5 motion-reduce:animate-none">
        <div className="h-44 rounded-[2rem] bg-white" />
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="h-52 rounded-[1.75rem] bg-white lg:col-span-2" />
          <div className="h-52 rounded-[1.75rem] bg-white" />
        </div>
      </div>
    </div>
  );
}
