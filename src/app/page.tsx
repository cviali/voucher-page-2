import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 gap-4">
      <h1 className="text-4xl font-bold">Voucher System</h1>
      <div className="flex gap-4">
        <Link href="/admin/login" className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
          Staff Login
        </Link>
        <Link href="/login" className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg hover:opacity-90 transition-opacity">
          Customer Login
        </Link>
      </div>
    </div>
  );
}
