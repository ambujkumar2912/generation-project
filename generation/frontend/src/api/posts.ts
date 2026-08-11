import { api } from './client';

export interface ApiPost {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  cohortId: string;
  author: { id: string; displayName: string; avatarUrl: string | null };
}
export interface FeedResponse { posts: ApiPost[]; nextCursor: string | null; }
export async function fetchPosts(limit = 15, cursor?: string) {
  const response = await api.get<FeedResponse>('/posts', { params: { limit, ...(cursor ? { cursor } : {}) } });
  return response.data;
}
export async function createPost(content: string) {
  const response = await api.post<{ post: ApiPost }>('/posts', { content });
  return response.data.post;
}
