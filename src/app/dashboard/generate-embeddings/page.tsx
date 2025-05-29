"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function GenerateEmbeddingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if token exists in localStorage
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (!token) {
      // If no token, redirect to login page
      router.push('/');
      return;
    }
    
    // If we have a stored user, use it
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
  }, [router]);

  const handleGenerateEmbeddings = async () => {
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch('/api/entries/generate-embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({})
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate embeddings');
      }
      
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Error generating embeddings:', error);
      setError(error instanceof Error ? error.message : String(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">MOSAIC</h1>
          <div className="flex items-center space-x-4">
            <Link href="/dashboard" className="text-gray-600 hover:text-gray-900">
              Return to Dashboard
            </Link>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Generate Embeddings for Semantic Search</h2>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-2">
              This utility will generate OpenAI embeddings for your existing entries, 
              enabling semantic search capabilities. This process will:
            </p>
            <ul className="list-disc pl-5 text-gray-600 space-y-1">
              <li>Find entries that don't have embeddings yet</li>
              <li>Generate vector embeddings using OpenAI's API</li>
              <li>Store these embeddings with your entries</li>
              <li>Allow semantic search to find related entries based on meaning, not just keywords</li>
            </ul>
          </div>
          
          <div className="mb-6">
            <button
              onClick={handleGenerateEmbeddings}
              disabled={loading}
              className={`px-4 py-2 ${loading ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-md text-sm font-medium transition-colors`}
            >
              {loading ? 'Processing...' : 'Generate Embeddings'}
            </button>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-md mb-4">
              <p className="text-red-800">{error}</p>
            </div>
          )}
          
          {results && (
            <div className="p-4 bg-green-50 border border-green-100 rounded-md mb-4">
              <h3 className="font-medium text-green-800 mb-2">Results:</h3>
              <p className="text-green-700">{results.message}</p>
              
              {results.results && (
                <div className="mt-4">
                  <p className="text-gray-600">
                    Total: {results.results.total}, 
                    Success: {results.results.success}, 
                    Failed: {results.results.failed}
                  </p>
                  
                  {results.results.failed > 0 && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-red-600">Show failed entries</summary>
                      <ul className="mt-2 list-disc pl-5 text-gray-600 space-y-1">
                        {results.results.entries
                          .filter((entry: any) => entry.status === 'failed')
                          .map((entry: any) => (
                            <li key={entry.id}>
                              Entry ID: {entry.id} - Error: {entry.error}
                            </li>
                          ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
          
          <div className="mt-6">
            <h3 className="font-medium text-gray-900 mb-2">Next steps:</h3>
            <p className="text-gray-600">
              After generating embeddings, return to the dashboard and try using the search 
              functionality. Your search queries will now find semantically related entries, 
              not just exact keyword matches.
            </p>
            <div className="mt-4">
              <Link
                href="/dashboard"
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Return to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
} 