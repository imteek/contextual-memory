"use client";

import { useCallback, useState } from 'react';
import { Entry } from './types';
import Link from 'next/link';

interface EntryDetailModalProps {
  entry: Entry;
  onClose: () => void;
  onDelete: (entryId: string) => Promise<void>;
  onEntryUpdated?: (updatedEntry: Entry) => void;
}

export default function EntryDetailModal({ entry, onClose, onDelete, onEntryUpdated }: EntryDetailModalProps) {
  const [loading, setLoading] = useState(false);
  const [currentEntry, setCurrentEntry] = useState<Entry>(entry);
  const [autoLinkResults, setAutoLinkResults] = useState<{
    success: boolean;
    linkedEntries: Array<{
      entryId: string;
      reason: string;
      score?: number;
    }>;
  } | null>(null);

  const handleDelete = async () => {
    if (confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      await onDelete(currentEntry._id);
      onClose();
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };
  
  // Function to find related entries automatically
  const handleFindRelated = useCallback(async () => {
    if (loading) return;
    
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch('/api/entries/auto-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          entryId: currentEntry._id,
          maxLinks: 5,
          threshold: 0.68 // Slightly higher threshold for stronger connections
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to find related entries');
      }
      
      const data = await response.json();
      setAutoLinkResults(data.data);
      
      // If successful and links were found, fetch the updated entry
      if (data.data.linkedEntries && data.data.linkedEntries.length > 0) {
        const entryResponse = await fetch(`/api/entries/${currentEntry._id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (entryResponse.ok) {
          const entryData = await entryResponse.json();
          setCurrentEntry(entryData.data);
          
          // Notify parent component if callback is provided
          if (onEntryUpdated) {
            onEntryUpdated(entryData.data);
          }
        }
      }
    } catch (error) {
      console.error('Error finding related entries:', error);
      alert('Failed to find related entries: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [currentEntry._id, loading, onEntryUpdated]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900">{currentEntry.title}</h2>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleDelete}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                title="Delete entry"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <span className="text-sm text-gray-500">{formatDate(currentEntry.createdAt)}</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {currentEntry.tags.map(tag => (
                <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  {tag}
                </span>
              ))}
            </div>
          </div>
          
          <div className="mt-4">
            {currentEntry.contentType === 'code' ? (
              <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto text-sm font-mono text-gray-800">{currentEntry.content}</pre>
            ) : (
              <p className="text-gray-700 whitespace-pre-wrap">{currentEntry.content}</p>
            )}
          </div>
          
          {/* Related Entries Section */}
          {currentEntry.linkedEntries && currentEntry.linkedEntries.length > 0 && (
            <div className="mt-6">
              <h3 className="text-md font-medium text-gray-900 mb-2">Related Entries</h3>
              <div className="space-y-2">
                {currentEntry.linkedEntries.map((link, index) => (
                  <div 
                    key={`${link.entryId}-${index}`} 
                    className={`p-3 rounded-md ${link.isContradiction ? 'bg-red-50 border border-red-200' : 'bg-gray-50 border border-gray-200'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className={`text-sm font-medium ${link.isContradiction ? 'text-red-700' : 'text-gray-800'}`}>
                          {link.reason}
                        </p>
                        {link.score && (
                          <p className="text-xs text-gray-500 mt-1">
                            Similarity: {Math.round(link.score * 100)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Auto-link Results */}
          {autoLinkResults && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm text-green-800">
                {autoLinkResults.linkedEntries.length > 0 
                  ? `Found ${autoLinkResults.linkedEntries.length} related entries!` 
                  : 'No new related entries found.'}
              </p>
            </div>
          )}
          
          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={handleFindRelated}
              disabled={loading}
              className={`px-4 py-2 ${loading ? 'bg-gray-300' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'} rounded-md text-sm font-medium transition-colors`}
            >
              {loading ? 'Finding related...' : 'Find Related Entries'}
            </button>
            
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 