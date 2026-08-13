import { useCallback, useEffect, useState } from 'react';
import { createPost, deletePost, fetchPosts, type ApiPost } from '../api/posts';
import { mockPosts, type HomePost } from '../mock/home';

const tones = ['from-[#5b90ce] via-[#7cb8ca] to-[#f0bc60]', 'from-[#f3c164] via-[#ed997a] to-[#6654a8]', 'from-[#f6cc68] via-[#e88975] to-[#4f527f]'];
function formatTime(value: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
  return minutes < 1 ? 'just now' : minutes < 60 ? `${minutes}m ago` : minutes < 1440 ? `${Math.floor(minutes / 60)}h ago` : `${Math.floor(minutes / 1440)}d ago`;
}
export function toHomePost(post: ApiPost): HomePost {
  const toneIndex = [...post.id].reduce((total, char) => total + char.charCodeAt(0), 0) % tones.length;
  return { id: post.id, author: post.author.displayName, authorId: post.author.id, time: formatTime(post.createdAt), kind: 'Text', content: post.content, tags: [], tone: tones[toneIndex], reactions: 0, comments: 0 };
}
export function useGenerationFeed() {
  const [posts, setPosts] = useState<HomePost[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try { const data = await fetchPosts(); setPosts(data.posts.map(toHomePost)); }
    catch { if (import.meta.env.DEV) setPosts(mockPosts); setError('Unable to load the live feed right now.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  const submit = useCallback(async (content: string) => { const created = await createPost(content); const post = toHomePost(created); setPosts((current) => [post, ...current]); return post; }, []);
  const remove = useCallback(async (postId: string) => { await deletePost(postId); setPosts((current) => current.filter((post) => post.id !== postId)); }, []);
  return { posts, loading, error, refresh, submit, remove };
}
