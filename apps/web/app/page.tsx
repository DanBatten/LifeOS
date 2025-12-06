import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-12">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            LifeOS
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Your personal multi-agent operating system
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Chat Card */}
          <Link href="/chat" className="block">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-shadow">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Chat
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Talk to your personal AI assistant. Ask about your schedule,
                health, tasks, or get recommendations.
              </p>
            </div>
          </Link>

          {/* Today Panel Card */}
          <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Today&apos;s Overview
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Health Status
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  No health data for today yet.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Upcoming Events
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  No events scheduled.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Priority Tasks
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  No tasks for today.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="flex flex-wrap gap-3">
            <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              Log Health Check-in
            </button>
            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              Add Task
            </button>
            <button className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
              Log Workout
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
