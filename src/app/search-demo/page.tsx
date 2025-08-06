import SearchInput from '@/components/SearchInput';

export default function SearchDemoPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Mock Navbar with Search */}
      <nav className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-6">
              <span className="text-xl font-semibold">Nextlog</span>
              <span className="mx-2 text-muted-foreground">/</span>
              <h1 className="text-xl font-semibold">Search Demo</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Search Input Demo */}
              <div className="block">
                <SearchInput className="w-64" />
              </div>
              
              <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
                New Contact
              </button>
              
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <span className="text-xs font-medium">DU</span>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-card border rounded-lg p-8 text-center">
            <h1 className="text-3xl font-bold mb-4">Navbar Search Feature Demo</h1>
            <p className="text-muted-foreground mb-6">
              This demonstrates the new callsign search functionality in the navbar.
            </p>
            
            <div className="mt-8 p-4 bg-green-50 dark:bg-green-950 rounded-lg text-left">
              <h3 className="font-semibold mb-4">🔍 How the Search Feature Works:</h3>
              <ul className="space-y-2 text-sm">
                <li><strong>1. Click the search input</strong> - Located in the top right of the navbar</li>
                <li><strong>2. Start typing a callsign</strong> - Autocomplete suggestions will appear</li>
                <li><strong>3. Select from suggestions</strong> - Shows name, QTH, and contact count</li>
                <li><strong>4. Navigate to advanced search</strong> - Selected callsign is pre-filled</li>
                <li><strong>5. Press Enter for direct search</strong> - If callsign not in suggestions</li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-left">
              <h3 className="font-semibold mb-4">⚡ Features:</h3>
              <ul className="space-y-2 text-sm">
                <li>• <strong>Real-time autocomplete</strong> - Searches as you type</li>
                <li>• <strong>Smart suggestions</strong> - Based on your contact history</li>
                <li>• <strong>Contact details</strong> - Shows name, location, and contact count</li>
                <li>• <strong>Keyboard navigation</strong> - Use arrow keys and Enter</li>
                <li>• <strong>Direct search fallback</strong> - Search for any callsign</li>
                <li>• <strong>Responsive design</strong> - Hidden on small screens to save space</li>
              </ul>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg text-left">
              <h3 className="font-semibold mb-4">🔧 Technical Implementation:</h3>
              <ul className="space-y-2 text-sm">
                <li>• <strong>API Endpoint:</strong> <code className="bg-muted px-1 rounded">/api/contacts/callsigns</code> - Provides autocomplete suggestions</li>
                <li>• <strong>Component:</strong> <code className="bg-muted px-1 rounded">SearchInput</code> - Reusable search component with popover</li>
                <li>• <strong>Integration:</strong> Added to existing Navbar component</li>
                <li>• <strong>Navigation:</strong> Routes to <code className="bg-muted px-1 rounded">/search?callsign=SELECTED</code></li>
                <li>• <strong>Libraries:</strong> Uses existing shadcn/ui Command and Popover components</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}