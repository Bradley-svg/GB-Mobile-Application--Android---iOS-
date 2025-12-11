import { WEB_API_BASE_URL } from "@/config/env";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-gray-900 dark:bg-black dark:text-gray-100">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-sm uppercase tracking-[0.2em] text-gray-500 dark:text-gray-400">
          Greenbro
        </p>
        <h1 className="text-3xl font-semibold">Dashboard is coming</h1>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          API base URL: <span className="font-mono">{WEB_API_BASE_URL}</span>
        </p>
      </div>
    </main>
  );
}
