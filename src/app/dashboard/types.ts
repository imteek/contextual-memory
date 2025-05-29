export interface User {
  _id: string;
  username: string;
  email: string;
  preferences: {
    defaultProject?: string;
    aiModel?: string;
  };
}

export interface Entry {
  _id: string;
  title: string;
  content: string;
  contentType: 'text' | 'code' | 'image';
  tags: string[];
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  linkedEntries?: Array<{
    entryId: string;
    reason: string;
    score?: number;
    isContradiction?: boolean;
  }>;
  embeddings?: number[];
}

export interface GraphNode {
  id: string;
  name: string;
  val: number;
  color: string;
  group: string;
}

export interface GraphLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
} 