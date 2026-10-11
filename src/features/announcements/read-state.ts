import { create } from 'zustand';
import { persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

interface ReadState {
  readIds: string[];
  markRead: (id: string) => void;
}

export const useAnnouncementReadState = create<ReadState>()(persist((set) => ({
  readIds: [],
  markRead: (id) => set((state) => ({ readIds: [id, ...state.readIds.filter((value) => value !== id)].slice(0, 500) })),
}), { name: 'ck.announcements.read', storage: persistStorage }));
