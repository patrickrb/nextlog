import Link from "next/link";

export default function Home() {
  return (
    <div className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-6">
            Nextlog
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Amateur Radio Logging Software
          </p>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-12 max-w-2xl mx-auto">
            Log your amateur radio contacts from anywhere. Built with Next.js
            and MongoDB for modern, reliable amateur radio logging.
          </p>

          <div className="flex gap-4 justify-center">
            <Link
              href="/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              Register
            </Link>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Contact Logging
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Log your amateur radio contacts with detailed information
              including frequency, mode, RST, and QSL status.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Search & Filter
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Quickly find contacts using powerful search and filtering options
              by callsign, date, band, and more.
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Export Data
            </h3>
            <p className="text-gray-600 dark:text-gray-300">
              Export your logbook data in various formats including ADIF for use
              with other amateur radio software.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
