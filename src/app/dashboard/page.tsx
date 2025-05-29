"use client";

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { User, Entry, GraphData } from './types';

// Import the graph component directly
import GraphView from './graph-view';

// Dynamically import components (client-side only)
const EntryDetailModal = dynamic(() => import('./EntryDetailModal'), { ssr: false });

// Mock entries for testing when API fails
const MOCK_ENTRIES: Entry[] = [
  {
    _id: '1',
    title: 'React Hooks Tips',
    content: 'Always use useCallback for event handlers passed to child components to prevent unnecessary re-renders.',
    contentType: 'text',
    tags: ['React', 'Hooks', 'Performance'],
    createdAt: '2023-01-15T09:30:00Z',
    updatedAt: '2023-01-15T09:30:00Z'
  },
  {
    _id: '2',
    title: 'CSS Grid Layout',
    content: `
.container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}
    `,
    contentType: 'code',
    tags: ['CSS', 'Layout', 'Grid'],
    createdAt: '2023-01-10T14:20:00Z',
    updatedAt: '2023-01-11T08:15:00Z'
  },
  {
    _id: '3',
    title: 'TypeScript Interface vs Type',
    content: 'Interfaces are generally preferred for defining object shapes as they can be extended and implemented by classes. Types are more flexible and can represent unions, intersections, and primitive types.',
    contentType: 'text',
    tags: ['TypeScript', 'Interface', 'Type'],
    createdAt: '2023-01-05T11:45:00Z',
    updatedAt: '2023-01-05T11:45:00Z'
  }
];

export default function Dashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'timeline' | 'graph'>('timeline');
  const [showNewEntryModal, setShowNewEntryModal] = useState(false);
  const [newEntry, setNewEntry] = useState({
    title: '',
    content: '',
    contentType: 'text' as 'text' | 'code' | 'image',
    tags: [] as string[]
  });
  const [newTag, setNewTag] = useState('');
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [searchStatus, setSearchStatus] = useState<'idle' | 'semantic' | 'text' | 'error'>('idle');
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [showOnlyConnected, setShowOnlyConnected] = useState(false);
  
  const graphRef = useRef<HTMLDivElement>(null);
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
    
    // If we have a stored user, use it initially
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user:', e);
      }
    }
    
    // Fetch current user data from API
    const fetchUserData = async () => {
      try {
        const response = await fetch('/api/auth/me', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          // If token is invalid, redirect to login page
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          router.push('/');
          return;
        }
        
        const data = await response.json();
        setUser(data.data.user);
        
        // Update stored user
        localStorage.setItem('user', JSON.stringify(data.data.user));
        
        // Fetch entries
        await fetchEntries();
        
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUserData();
  }, [router]);
  
  useEffect(() => {
    // Generate graph data when entries change
    if (entries.length > 0) {
      generateGraphData();
    }
  }, [entries]);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/');
  };
  
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      // If search is empty, reset to show all entries
      setSearchStatus('idle');
      await fetchEntries();
      return;
    }
    
    try {
      setLoading(true);
      setSearchStatus('idle');
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      // Get user ID from the token
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = userData._id;
      
      if (!userId) throw new Error('User ID not found');
      
      // Call the search API with a minimum relevance threshold
      const response = await fetch('/api/entries/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          query: searchQuery,
          userId,
          minRelevance: 0.65 // Only return results that are at least 65% similar
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to search entries');
      }
      
      const data = await response.json();
      
      // Check whether semantic search was used
      const testResponse = await fetch(`/api/test-search?query=${encodeURIComponent(searchQuery)}`);
      const testData = await testResponse.json();
      
      if (testData.data.hasEmbeddings) {
        setSearchStatus('semantic');
      } else {
        setSearchStatus('text');
      }
      
      // Update entries with search results
      setEntries(data.data);
      
      // Also update graph data with the filtered entries
      if (data.data.length > 0) {
        generateGraphData(data.data);
      } else {
        // If no results, show empty graph
        setGraphData({ nodes: [], links: [] });
      }
      
    } catch (error) {
      console.error('Error searching entries:', error);
      setSearchStatus('error');
      alert('Failed to search entries: ' + (error instanceof Error ? error.message : 'Unknown error'));
      // In case of error, fetch all entries to avoid an empty state
      await fetchEntries();
    } finally {
      setLoading(false);
    }
  };
  
  const handleNewEntrySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      // Send entry to API
      const response = await fetch('/api/entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: newEntry.title,
          content: newEntry.content,
          contentType: newEntry.contentType,
          tags: newEntry.tags
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create entry');
      }
      
      // Get the created entry
      const data = await response.json();
      
      // Add to entries
      setEntries([data.data, ...entries]);
      
      // Show auto-linking results if available
      if (data.autoLinking && data.autoLinking.success && data.autoLinking.linkedEntries.length > 0) {
        alert(`Entry created! Automatically linked to ${data.autoLinking.linkedEntries.length} related entries.`);
      } else {
        alert('Entry created successfully!');
      }
      
      // Reset form and close modal
      setShowNewEntryModal(false);
      setNewEntry({
        title: '',
        content: '',
        contentType: 'text' as 'text' | 'code' | 'image',
        tags: []
      });
      
      // Regenerate graph data with the new entry
      generateGraphData([data.data, ...entries]);
      
    } catch (error) {
      console.error('Error creating entry:', error);
      alert('Failed to create entry: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  const handleAddTag = () => {
    if (newTag && !newEntry.tags.includes(newTag)) {
      setNewEntry({
        ...newEntry,
        tags: [...newEntry.tags, newTag]
      });
      setNewTag('');
      
      // In a real app, we would get AI-suggested tags based on content
      // For now, use some mock suggestions
      if (newEntry.tags.length === 0) {
        setSuggestedTags(['React', 'JavaScript', 'Frontend', 'Debug']);
      } else {
        setSuggestedTags([]);
      }
    }
  };
  
  const handleRemoveTag = (tagToRemove: string) => {
    setNewEntry({
      ...newEntry,
      tags: newEntry.tags.filter(tag => tag !== tagToRemove)
    });
  };
  
  const handleSuggestedTag = (tag: string) => {
    if (!newEntry.tags.includes(tag)) {
      setNewEntry({
        ...newEntry,
        tags: [...newEntry.tags, tag]
      });
      // Remove from suggestions
      setSuggestedTags(suggestedTags.filter(t => t !== tag));
    }
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };
  
  // Function to fetch entries
  const fetchEntries = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      
      const response = await fetch('/api/entries', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      
      const data = await response.json();
      setEntries(data.data);
    } catch (error) {
      console.error('Error fetching entries:', error);
      // If API fails, use mock data for now
      setEntries(MOCK_ENTRIES);
    }
  };
  
  // Helper function to get color based on content type
  const getContentTypeColor = useCallback((contentType: string): string => {
    switch (contentType) {
      case 'code':
        return '#059669'; // Green
      case 'image':
        return '#d97706'; // Amber
      default:
        return '#3b82f6'; // Blue
    }
  }, []);

  // Function to generate graph visualization data
  const generateGraphData = useCallback((entriesToUse = entries) => {
    // Prepare nodes and links arrays with proper structure for D3
    const nodes: GraphData['nodes'] = [];
    const links: GraphData['links'] = [];
    const tagMap = new Map<string, number>();
    
    // First pass: Add entry nodes and collect tag information
    entriesToUse.forEach(entry => {
      // Add entry node
      nodes.push({
        id: entry._id,
        name: entry.title,
        val: 3,
        color: getContentTypeColor(entry.contentType),
        group: 'entry'
      });
      
      // Track tags
      entry.tags.forEach(tag => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, 1);
        } else {
          tagMap.set(tag, tagMap.get(tag)! + 1);
        }
      });
    });
    
    // Second pass: Add tag nodes
    tagMap.forEach((count, tag) => {
      nodes.push({
        id: `tag-${tag}`,
        name: tag,
        val: Math.min(Math.max(count, 2), 10), // Scale tag size based on count (between 2 and 10)
        color: '#4f46e5', // Indigo color for tags
        group: 'tag'
      });
    });
    
    // Third pass: Add links after all nodes are created
    entriesToUse.forEach(entry => {
      // Add links between entries and their tags
      entry.tags.forEach(tag => {
        links.push({
          source: entry._id,
          target: `tag-${tag}`,
          value: 1
        });
      });
      
      // Add links between entries and their linked entries
      if (entry.linkedEntries) {
        entry.linkedEntries.forEach(link => {
          // Only add the link if the target entry exists
          if (entriesToUse.some(e => e._id === link.entryId)) {
            links.push({
              source: entry._id,
              target: link.entryId.toString(),
              value: link.score ? Math.max(1, Math.min(5, link.score * 5)) : 2, // Scale link width based on score
              color: link.isContradiction ? '#ef4444' : undefined // Red color for contradiction links
            });
          }
        });
      }
    });
    
    // Set the graph data
    setGraphData({ nodes, links });
  }, [entries, getContentTypeColor]);
  
  const handleNodeClick = useCallback((node: any) => {
    console.log('Node clicked:', node);
    
    if (!node) return;
    
    // Set the focused node ID
    setFocusedNodeId(node.id);
    
    if (node.group === 'entry') {
      // Find the entry and show its details
      const entry = entries.find(e => e._id === node.id);
      if (entry) {
        setSelectedEntry(entry);
      }
    } else if (node.group === 'tag') {
      // Extract tag name from the ID (remove the "tag-" prefix)
      const tagName = node.name;
      
      // Update search query and trigger search
      setSearchQuery(tagName);
      
      // We need to manually trigger the search since just updating the state won't do it
      setTimeout(() => {
        // We're using a timeout to ensure the search query is updated first
        const form = document.querySelector('form[role="search"]');
        if (form instanceof HTMLFormElement) {
          form.requestSubmit();
        }
      }, 0);
    }
  }, [entries]);
  
  // Toggle between showing all nodes and only connected nodes
  const handleToggleConnectionView = useCallback(() => {
    setShowOnlyConnected(prev => !prev);
  }, []);
  
  // When closing the modal, clear the focused node if showOnlyConnected is true
  const handleCloseModal = useCallback(() => {
    setSelectedEntry(null);
    if (showOnlyConnected) {
      // Either reset to show all nodes or keep the focused view without the modal
      if (confirm('Return to full graph view?')) {
        setFocusedNodeId(null);
        setShowOnlyConnected(false);
      }
    }
  }, [showOnlyConnected]);
  
  // Add a function to delete an entry
  const handleDeleteEntry = async (entryId: string) => {
    if (!confirm('Are you sure you want to delete this entry? This action cannot be undone.')) {
      return;
    }
    
    try {
      setLoading(true);
      
      const token = localStorage.getItem('token');
      if (!token) throw new Error('Not authenticated');
      
      const response = await fetch(`/api/entries/${entryId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete entry');
      }
      
      // Remove the deleted entry from the state
      setEntries(prevEntries => prevEntries.filter(entry => entry._id !== entryId));
      
      // Also update any entries that might have had references to the deleted entry
      setEntries(prevEntries => 
        prevEntries.map(entry => {
          if (entry.linkedEntries && entry.linkedEntries.some(link => link.entryId === entryId)) {
            // Return a new entry object with filtered linkedEntries
            return {
              ...entry,
              linkedEntries: entry.linkedEntries.filter(link => link.entryId !== entryId)
            };
          }
          return entry;
        })
      );
      
      // Close the modal if it was open
      if (selectedEntry && selectedEntry._id === entryId) {
        setSelectedEntry(null);
      }
      
      // Regenerate graph data
      generateGraphData(entries.filter(entry => entry._id !== entryId));
      
    } catch (error) {
      console.error('Error deleting entry:', error);
      alert('Failed to delete entry: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };
  
  // Function to handle viewing connections of a specific entry in graph view
  const handleViewConnections = useCallback((entryId: string) => {
    // Switch to graph view if not already in it
    setViewMode('graph');
    
    // Set the focused node ID
    setFocusedNodeId(entryId);
    
    // Enable "show only connected" mode
    setShowOnlyConnected(true);
  }, []);
  
  if (loading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-indigo-600">MOSAIC</h1>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Logged in as <span className="font-medium text-black">{user?.username}</span>
            </div>
            <Link href="/dashboard/generate-embeddings" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-indigo-600">
              Generate Embeddings
            </Link>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
          <form onSubmit={handleSearch} className="w-full md:w-1/2" role="search">
            <div className="relative">
              <input
                type="text"
                className="w-full px-4 py-2 pr-10 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Search entries, code snippets, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button 
                type="submit" 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-indigo-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
            <div className="flex items-center mt-1">
              <p className="text-xs text-gray-500">
                {searchStatus === 'idle' && 'Uses semantic search powered by OpenAI to find related entries'}
                {searchStatus === 'semantic' && 'Semantic search active - showing entries most similar to your query'}
                {searchStatus === 'text' && 'Text search active - OpenAI embeddings not available'}
                {searchStatus === 'error' && 'Search error - please check your network and try again'}
              </p>
              {searchStatus === 'semantic' && (
                <span className="ml-2 flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              )}
              {searchStatus === 'text' && (
                <span className="ml-2 flex h-2 w-2 relative">
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-yellow-500"></span>
                </span>
              )}
            </div>
          </form>
          
          <div className="flex space-x-4">
            <div className="inline-flex rounded-md shadow-sm">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-4 py-2 text-sm font-medium rounded-l-md ${viewMode === 'timeline' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Timeline
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`px-4 py-2 text-sm font-medium ${viewMode === 'graph' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
              >
                Graph
              </button>
            </div>
            
            <button
              onClick={() => setShowNewEntryModal(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              New Entry
            </button>
          </div>
        </div>
        
        {/* Content Area */}
        {viewMode === 'timeline' ? (
          <div className="space-y-6">
            {entries.length === 0 ? (
              <div className="bg-white shadow rounded-lg p-6 text-center">
                <p className="text-gray-500">No entries found. Start by creating a new entry!</p>
              </div>
            ) : (
              entries.map(entry => (
                <div key={entry._id} className="bg-white shadow rounded-lg overflow-hidden hover:shadow-md transition-shadow">
                  <div className="p-6">
                    <div className="flex justify-between items-start">
                      <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">{formatDate(entry.createdAt)}</span>
                        <button
                          onClick={() => handleDeleteEntry(entry._id)}
                          className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete entry"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      {entry.contentType === 'code' ? (
                        <pre className="bg-gray-50 p-3 rounded-md overflow-x-auto text-sm font-mono text-gray-800">{entry.content}</pre>
                      ) : (
                        <p className="text-gray-700">{entry.content}</p>
                      )}
                    </div>
                    
                    <div className="mt-4 flex flex-wrap gap-2">
                      {entry.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg p-6 h-[600px]">
            {graphData.nodes.length > 0 ? (
              <GraphView 
                graphData={graphData} 
                onNodeClick={handleNodeClick}
                focusNodeId={focusedNodeId}
                showOnlyConnected={showOnlyConnected}
                onToggleConnectionView={handleToggleConnectionView}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No data available for graph visualization</p>
              </div>
            )}
          </div>
        )}
      </main>
      
      {/* New Entry Modal */}
      {showNewEntryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-gray-900">Create New Entry</h2>
                <button
                  onClick={() => setShowNewEntryModal(false)}
                  className="text-gray-400 hover:text-gray-500"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <form onSubmit={handleNewEntrySubmit}>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      id="title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      value={newEntry.title}
                      onChange={(e) => setNewEntry({...newEntry, title: e.target.value})}
                      required
                    />
                  </div>
                  
                  <div>
                    <label htmlFor="contentType" className="block text-sm font-medium text-gray-700 mb-1">Content Type</label>
                    <select
                      id="contentType"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      value={newEntry.contentType}
                      onChange={(e) => setNewEntry({...newEntry, contentType: e.target.value as 'text' | 'code' | 'image'})}
                    >
                      <option value="text">Text</option>
                      <option value="code">Code Snippet</option>
                      <option value="image">Image</option>
                    </select>
                  </div>
                  
                  <div>
                    <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                    <textarea
                      id="content"
                      rows={6}
                      className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${newEntry.contentType === 'code' ? 'font-mono' : ''}`}
                      value={newEntry.content}
                      onChange={(e) => setNewEntry({...newEntry, content: e.target.value})}
                      required
                    ></textarea>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {newEntry.tags.map(tag => (
                        <span key={tag} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1.5 text-indigo-600 hover:text-indigo-800"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex">
                      <input
                        type="text"
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Add a tag"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                      />
                      <button
                        type="button"
                        className="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-md hover:bg-gray-200"
                        onClick={handleAddTag}
                      >
                        Add
                      </button>
                    </div>
                    
                    {/* AI Suggested Tags */}
                    {suggestedTags.length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs text-gray-500 mb-1">Suggested tags:</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestedTags.map(tag => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => handleSuggestedTag(tag)}
                              className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="mt-6 flex justify-end">
                  <button
                    type="button"
                    className="mr-4 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setShowNewEntryModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm font-medium hover:bg-indigo-700"
                  >
                    Create Entry
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      
      {/* Entry Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal
          entry={selectedEntry}
          onClose={handleCloseModal}
          onDelete={handleDeleteEntry}
          isGraphMode={viewMode === 'graph'}
          onViewConnections={handleViewConnections}
          onEntryUpdated={(updatedEntry, allEntries) => {
            if (allEntries) {
              // If we have a full set of entries, update the entire array
              setEntries(allEntries);
            } else {
              // Otherwise just update the specific entry
              setEntries(entries.map(entry => 
                entry._id === updatedEntry._id ? updatedEntry : entry
              ));
            }
            
            // Update the selected entry
            setSelectedEntry(updatedEntry);
            
            // Regenerate graph data to reflect the new links
            generateGraphData();
          }}
        />
      )}
    </div>
  );
} 