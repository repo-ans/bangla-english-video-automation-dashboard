import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-4 text-center dark:bg-slate-900">
      <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-50">404</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300">This page doesn&rsquo;t exist.</p>
      <Link to="/videos" className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400">
        Back to videos
      </Link>
    </div>
  );
}
