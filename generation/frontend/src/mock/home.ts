// Frontend-only development content. Future API responses should map to these
// view models so the Home UI can remain unchanged when real data arrives.

export interface HomeMoment { id: string; name: string; note: string; }
export interface HomePost { id: string; author: string; time: string; kind: string; content: string; tags: string[]; tone: string; reactions: number; comments: number; }
export interface HomeTopic { id: string; icon: string; title: string; talkingCount: number; }
export interface HomeHelpRequest { id: string; authorInitial: string; question: string; answerCount: number; }
export interface ComposerAction { id: string; icon: string; label: string; }
export interface HomePrompt { id: string; text: string; label: string; }

export const mockMoments: HomeMoment[] = [
  { id: 'moment-riya', name: 'Riya', note: 'First day at college' }, { id: 'moment-arjun', name: 'Arjun', note: 'New guitar finally' },
  { id: 'moment-meera', name: 'Meera', note: 'Trip to Goa' }, { id: 'moment-karan', name: 'Karan', note: 'Placed! Finally' }, { id: 'moment-sana', name: 'Sana', note: 'Birthday vibes' },
];
export const mockPosts: HomePost[] = [
  { id: 'post-priya', author: 'Priya S.', time: '2h ago', kind: 'Moment', content: 'Anyone else starting college this month? Feeling both excited and terrified at the same time. Would love to hear from you all!', tags: ['college life', 'new beginnings', 'help'], tone: 'from-[#f3c164] via-[#ed997a] to-[#6654a8]', reactions: 64, comments: 28 },
  { id: 'post-rohan', author: 'Rohan K.', time: '5h ago', kind: 'Achievement', content: 'I finally got my first internship! Six months of learning and it actually paid off. If anyone is starting their search, DM me.', tags: ['career', 'wins'], tone: 'from-[#5b90ce] via-[#7cb8ca] to-[#f0bc60]', reactions: 182, comments: 47 },
  { id: 'post-meera', author: 'Meera T.', time: '7h ago', kind: 'Life', content: 'Watched the most beautiful sunset today at Palolem Beach, Goa. Some moments just stay with you forever.', tags: ['travel', 'life lately'], tone: 'from-[#f6cc68] via-[#e88975] to-[#4f527f]', reactions: 38, comments: 14 },
];
export const mockTopics: HomeTopic[] = [
  { id: 'admissions', icon: '▣', title: 'College Admissions 2024', talkingCount: 482 }, { id: 'internships', icon: '♧', title: 'First Internship Stories', talkingCount: 396 },
  { id: 'laptops', icon: '▤', title: 'Laptop Recommendations', talkingCount: 310 }, { id: 'wellbeing', icon: '♥', title: 'Mental Health Check-in', talkingCount: 224 },
];
export const mockHelpRequests: HomeHelpRequest[] = [
  { id: 'branch', authorInitial: 'N', question: 'Help with choosing engineering branch', answerCount: 12 }, { id: 'time', authorInitial: 'A', question: 'How to manage time in first year?', answerCount: 9 }, { id: 'dsa', authorInitial: 'R', question: 'Best resources to learn DSA?', answerCount: 15 },
];
export const mockComposerActions: ComposerAction[] = [{ id: 'photo', icon: '▧', label: 'Photo' }, { id: 'video', icon: '▣', label: 'Video' }, { id: 'question', icon: '?', label: 'Question' }, { id: 'poll', icon: '▥', label: 'Poll' }, { id: 'note', icon: '▤', label: 'Note' }];
export const mockPrompts: HomePrompt[] = [{ id: 'laptop-advice', text: 'Which laptop should I buy for college under ₹60K?', label: 'Advice' }, { id: 'salary-moment', text: 'My first salary came today — literally cried a little.', label: 'Life' }];
export const mockInterests = ['Music', 'Travel', 'Fitness', 'Coding', 'Photography', 'Books'];
