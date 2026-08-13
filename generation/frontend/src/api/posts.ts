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
export interface UserPostsResponse extends FeedResponse { visibility: 'visible' | 'limited_to_same_cohort'; }
export async function fetchPosts(limit = 15, cursor?: string) {
  const response = await api.get<FeedResponse>('/posts', { params: { limit, ...(cursor ? { cursor } : {}) } });
  return response.data;
}
export async function createPost(content: string) {
  const response = await api.post<{ post: ApiPost }>('/posts', { content });
  return response.data.post;
}
export async function fetchPostsByUsername(username: string, limit = 15) {
  const response = await api.get<UserPostsResponse>(`/posts/user/${encodeURIComponent(username)}`, { params: { limit } });
  return response.data;
}
