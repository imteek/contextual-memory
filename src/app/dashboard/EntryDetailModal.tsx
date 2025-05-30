"use client";

import { useCallback, useState, useEffect } from 'react';
import { Entry } from './types';
import Link from 'next/link';

// Component to fetch and display the details of a linked entry
function LinkedEntryDetails({ entryId }: { entryId: string }) {
  const [entryDetails, setEntryDetails] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntryDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const token = localStorage.getItem('token');
        if (!token) throw new Error('Not authenticated');
        
        const response = await fetch(`/api/entries/${entryId}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch entry details');
        }
        
        const data = await response.json();
        setEntryDetails(data.data);
      } catch (error) {
        console.error('Error fetching entry details:', error);
        setError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };
    
    fetchEntryDetails();
  }, [entryId]);
  
  if (loading) {
    return <div className="text-sm text-gray-500">Loading entry details...</div>;
  }
  
  if (error) {
    return <div className="text-sm text-red-500">Error: {error}</div>;
  }
  
  if (!entryDetails) {
    return <div className="text-sm text-gray-500">Entry not found</div>;
  }
  
  return (
    <div className="border-t border-blue-200 pt-2 mt-1">
      <h4 className="text-sm font-medium text-gray-900">{entryDetails.title}</h4>
      <div className="mt-1 text-xs text-gray-600 line-clamp-3">
        {entryDetails.contentType === 'code' ? (
          <pre className="bg-gray-50 p-2 rounded-md overflow-x-auto text-xs font-mono text-gray-800 max-h-24">{entryDetails.content}</pre>
        ) : (
          <p className="text-gray-600 whitespace-pre-wrap">{entryDetails.content.substring(0, 150)}{entryDetails.content.length > 150 ? '...' : ''}</p>
        )}
      </div>
      {entryDetails.tags && entryDetails.tags.length > 0 && (
        <div className="mt-1 flex flex-wrap gap-1">
          {entryDetails.tags.slice(0, 3).map(tag => (
            <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              {tag}
            </span>
          ))}
          {entryDetails.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{entryDetails.tags.length - 3} more</span>
          )}
        </div>
      )}
    </div>
  );
}

interface EntryDetailModalProps {
  entry: Entry;
  onClose: () => void;
  onDelete: (entryId: string) => void;
  onEntryUpdated?: (updatedEntry: Entry, allEntries?: Entry[]) => void;
  onViewConnections?: (entryId: string) => void;
  isGraphMode?: boolean;
}

export default function EntryDetailModal({ 
  entry, 
  onClose, 
  onDelete, 
  onEntryUpdated,
  onViewConnections,
  isGraphMode = false
}: EntryDetailModalProps) {
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

  const handleDelete = () => {
    onDelete(currentEntry._id);
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
      
      // Show appropriate toast notification based on results
      if (data.data.linkedEntries.length > 0) {
        (window as any).showSuccessToast(`Found ${data.data.linkedEntries.length} related entries!`);
      } else {
        (window as any).showInfoToast('No new related entries found.');
      }
      
      // If successful and links were found, fetch the updated entry and all linked entries
      if (data.data.linkedEntries && data.data.linkedEntries.length > 0) {
        // First get the current (source) entry
        const entryResponse = await fetch(`/api/entries/${currentEntry._id}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (entryResponse.ok) {
          const entryData = await entryResponse.json();
          setCurrentEntry(entryData.data);
          
          // Notify parent component to refresh all entries to capture the bidirectional links
          if (onEntryUpdated) {
            // Fetch all entries to get the complete updated state with bidirectional links
            const allEntriesResponse = await fetch('/api/entries', {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            
            if (allEntriesResponse.ok) {
              const allEntriesData = await allEntriesResponse.json();
              
              // Update the current entry with the latest version from the full dataset
              const updatedCurrentEntry = allEntriesData.data.find(
                (entry: any) => entry._id === currentEntry._id
              );
              
              if (updatedCurrentEntry) {
                setCurrentEntry(updatedCurrentEntry);
                // Pass the full set of entries to the parent for update
                onEntryUpdated(updatedCurrentEntry, allEntriesData.data);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error finding related entries:', error);
      (window as any).showErrorToast('Failed to find related entries: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [currentEntry._id, loading, onEntryUpdated]);
  
  // Handle viewing connections in graph mode
  const handleViewConnections = useCallback(() => {
    if (onViewConnections) {
      onViewConnections(currentEntry._id);
      onClose();
    }
  }, [currentEntry._id, onViewConnections, onClose]);

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
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-md font-medium text-gray-900">Related Entries</h3>
                <button
                  type="button"
                  onClick={handleFindRelated}
                  disabled={loading}
                  className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center ${loading ? 'bg-gray-300' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  {loading ? 'Finding...' : 'Find more connections'}
                </button>
              </div>
              <div className="space-y-3">
                {currentEntry.linkedEntries.map((link, index) => (
                  <div 
                    key={`${link.entryId}-${index}`} 
                    className={`p-4 rounded-md ${link.isContradiction ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}
                  >
                    <div className="flex flex-col space-y-2">
                      <div className="flex justify-between items-start">
                        <p className={`text-sm font-medium ${link.isContradiction ? 'text-red-700' : 'text-blue-700'}`}>
                          {link.reason}
                        </p>
                        {link.score && (
                          <span className="text-xs py-1 px-2 bg-blue-100 rounded-full text-blue-800">
                            {Math.round(link.score * 100)}% similar
                          </span>
                        )}
                      </div>
                      
                      {/* New: Fetch and show related entry content */}
                      <LinkedEntryDetails entryId={link.entryId.toString()} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="mt-6 flex justify-between">
            <div className="flex space-x-2">
              {!currentEntry.linkedEntries || currentEntry.linkedEntries.length === 0 ? (
                <button
                  type="button"
                  onClick={handleFindRelated}
                  disabled={loading}
                  className={`px-4 py-2 ${loading ? 'bg-gray-300' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'} rounded-md text-sm font-medium transition-colors`}
                >
                  {loading ? 'Finding related...' : 'Find Related Entries'}
                </button>
              ) : null}
              
              {onViewConnections && !isGraphMode && (
                <button
                  type="button"
                  onClick={handleViewConnections}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
                >
                  View Connections in Graph
                </button>
              )}
            </div>
            
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